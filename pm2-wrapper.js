const { exec } = require("child_process");

const child = exec("pnpm start", { cwd: __dirname, env: process.env });

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
