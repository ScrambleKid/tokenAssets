import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import {extname} from 'path';
import {trace} from 'potrace';
import sharp from 'sharp';
import {Argv} from './interfaces/Argv';
import {IToken} from './interfaces/IToken';

async function main(...argv: any[]) {
	let args: {[key in Argv]?: string} = {
		company: ''
	};
	for (let i = 0; i < argv.length - 1; i += 2) {
		if (argv[i].includes('--')) {
			args[argv[i].replace('--', '') as Argv] = argv[i + 1] ?? '';
		}
	}

	if (!args.company) {
		console.error('Please provide a company name using --company');
		process.exit(1);
	}
	console.log('Building', args.company);

	const company = args.company;
	const companyTokensPath = path.join(__dirname, `/company/${company}/tokens.ts`);

	if (!fs.existsSync(companyTokensPath)) {
		console.error(`Tokens file not found for company: ${company}`);
		process.exit(1);
	}

	const tokenConfig = require(companyTokensPath);
	// console.log(tokenConfig.tokens);

	await createTokenFolders(tokenConfig, company);
}

const createTokenFolders = async (tokenConfig: {tokens: IToken[]}, company: string) => {
	const tokensDir = path.join(__dirname, '../../tokens');
	console.log(tokensDir);

	for (const token of tokenConfig.tokens) {
		const chainDir = path.join(tokensDir, token.chain.toString());
		const tokenDir = path.join(chainDir, token.address.length == 42 ? token.address.toLowerCase() : token.address);

		if (!fs.existsSync(chainDir)) {
			fs.mkdirSync(chainDir);
		}

		if (!fs.existsSync(tokenDir)) {
			fs.mkdirSync(tokenDir);
		}

		const logoUrl = token.logo;
		const logoExt = extname(logoUrl);
		const logoOriginalPath = path.join(tokenDir, `temp${logoExt}`);
		const logoPngPath = path.join(tokenDir, 'logo.png');
		const logoSvgPath = path.join(tokenDir, 'logo.svg');
		const logo32Path = path.join(tokenDir, 'logo-32.png');
		const logo128Path = path.join(tokenDir, 'logo-128.png');

		try {
			const response = await axios.get(logoUrl, {responseType: 'arraybuffer'});
			fs.writeFileSync(logoOriginalPath, response.data);

			// Convert the original logo to PNG format
			await sharp(logoOriginalPath).toFormat('png').toFile(logoPngPath);

			// Resize the PNG to 128x128 and 32x32
			await sharp(logoPngPath).resize(128, 128).toFile(logo128Path);
			await sharp(logoPngPath).resize(32, 32).toFile(logo32Path);

			// Convert PNG to SVG using potrace
			trace(logoPngPath, (err, svg) => {
				if (err) throw err;
				fs.writeFileSync(logoSvgPath, svg);
			});

			// Remove the temporary file
			fs.unlinkSync(logoOriginalPath);
		} catch (error) {
			console.error(`Failed to download or process logo from URL: ${logoUrl}`, error);
		}
	}
};

main(...process.argv.slice(2));
