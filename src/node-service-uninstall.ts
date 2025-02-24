import {Service} from "node-windows"

const scriptPath = `${__dirname}/../dist/index.js`;

const svc = new Service({
  name:'ServiceTermografia',
  description: 'Serviço consumo de api sitrad',
  script: scriptPath,

});


svc.on('uninstall',function(){
  console.log("Serviço desinstalado.")
});

svc.on('error', (err) => {
  console.error('Erro ao instalar o serviço:', err);
});

svc.uninstall();