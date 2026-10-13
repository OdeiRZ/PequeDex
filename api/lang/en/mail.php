<?php

return [

    // Subcopy under any mail with an action button - generic across
    // notifications, not just password reset, so it lives at the top level.
    'trouble' => "If the button doesn't work, copy and paste this URL into your browser:",

    'verify_email' => [
        'subject' => 'Confirm your PequeDex email',
        'greeting' => 'Hello!',
        'intro' => 'Press the button to confirm your email address and finish creating your PequeDex account.',
        'action' => 'Confirm email',
        'expire' => 'This link will expire in :count minutes.',
        'outro' => "If you didn't create a PequeDex account, no further action is required.",
        'salutation' => "Best,\nThe PequeDex team",
    ],

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
