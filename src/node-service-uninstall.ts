import {Service} from "node-windows"

const svc = new Service({
  name:'ServiceTermografia',
  description: 'Serviço consumo de api sitrad',
  script: 'C:\\Users\\Usuário\\service-termografia\\index.ts',

});


svc.on('uninstall',function(){
  console.log("Serviço desinstalado.")
});

svc.uninstall();