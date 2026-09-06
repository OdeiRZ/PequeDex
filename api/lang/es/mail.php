<?php

return [

    // Subcopy under any mail with an action button - generic across
    // notifications, not just password reset, so it lives at the top level.
    'trouble' => 'Si el botón no funciona, copia y pega esta URL en tu navegador:',

    'reset_password' => [
        'subject' => 'Restablece tu contraseña de PequeDex',
        'greeting' => '¡Hola!',
        'intro' => 'Recibes este email porque hemos recibido una solicitud para restablecer la contraseña de tu cuenta de PequeDex.',
        'action' => 'Restablecer contraseña',
        'expire' => 'Este enlace caduca dentro de :count minutos.',
        'outro' => 'Si no has solicitado un cambio de contraseña, no tienes que hacer nada más: tu contraseña actual sigue siendo válida.',
        'salutation' => "Un saludo,\nEl equipo de PequeDex",
    ],

];
