<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    /**
     * Laravel's own ResetPassword notification builds a generic, unbranded
     * mail ("Laravel", English-only). This overrides just the message
     * content - the URL building (resetUrl(), which honours the
     * createUrlUsing() callback registered in AppServiceProvider) is
     * inherited unchanged.
     */
    protected function buildMailMessage($url): MailMessage
    {
        $expireMinutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject(__('mail.reset_password.subject'))
            ->greeting(__('mail.reset_password.greeting'))
            ->line(__('mail.reset_password.intro'))
            ->action(__('mail.reset_password.action'), $url)
            ->line(__('mail.reset_password.expire', ['count' => $expireMinutes]))
            ->line(__('mail.reset_password.outro'))
            ->salutation(__('mail.reset_password.salutation'));
    }
}
