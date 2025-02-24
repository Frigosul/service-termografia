"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_windows_1 = require("node-windows");
const scriptPath = `${__dirname}/../dist/index.js`;
const svc = new node_windows_1.Service({
    name: 'ServiceTermografia',
    description: 'Serviço consumo de api sitrad',
    script: scriptPath,
});
svc.on('uninstall', function () {
    console.log("Serviço desinstalado.");
});
svc.on('error', (err) => {
    console.error('Erro ao instalar o serviço:', err);
});
svc.uninstall();
