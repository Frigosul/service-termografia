import {Service} from "node-windows"

const scriptPath = `${__dirname}/../dist/index.js`;

// script: 'C:\\Users\\Usuário\\service-termografia\\index.ts',
const svc = new Service({
  name:'ServiceTermografia',
  description: 'Serviço consumo de api sitrad',
  script: scriptPath,  

});


svc.on('install',function(){
  svc.start();
});

svc.on('error', (err) => {
  console.error('Erro ao instalar o serviço:', err);
});

svc.install();