<?php

return [

    // Subcopy under any mail with an action button - generic across
    // notifications, not just password reset, so it lives at the top level.
    'trouble' => "If the button doesn't work, copy and paste this URL into your browser:",

    'reset_password' => [
        'subject' => 'Reset your PequeDex password',
        'greeting' => 'Hello!',
        'intro' => 'You are receiving this email because we received a password reset request for your PequeDex account.',
        'action' => 'Reset password',
        'expire' => 'This link will expire in :count minutes.',
        'outro' => "If you didn't request a password reset, no further action is required: your current password is still valid.",
        'salutation' => "Best,\nThe PequeDex team",
    ],

];
