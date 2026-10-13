<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends VerifyEmail
{
    /** Minutos que vale el enlace de confirmación. */
    public const EXPIRE_MINUTES = 60;

    /**
     * El enlace del correo apunta a la PÁGINA de la SPA (`/verify-email`), no a
     * la ruta del API: abrirlo en el navegador mostraría JSON. La SPA reenvía
     * `expires` y `signature` al API, que valida la firma.
     *
     * La firma es RELATIVA (solo ruta + parámetros, sin el host): detrás de Render
     * el servidor puede ver otro esquema o host que el público (http/https,
     * onrender.com/dominio propio) y una firma con host no validaría nunca.
     */
    protected function verificationUrl($notifiable): string
    {
        $relative = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(self::EXPIRE_MINUTES),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())],
            absolute: false,
        );

        $query = (string) parse_url($relative, PHP_URL_QUERY);
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        return "{$frontend}/verify-email?id={$notifiable->getKey()}&hash=".sha1($notifiable->getEmailForVerification())."&{$query}";
    }

    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject(__('mail.verify_email.subject'))
            ->greeting(__('mail.verify_email.greeting'))
            ->line(__('mail.verify_email.intro'))
            ->action(__('mail.verify_email.action'), $url)
            ->line(__('mail.verify_email.expire', ['count' => self::EXPIRE_MINUTES]))
            ->line(__('mail.verify_email.outro'))
            ->salutation(__('mail.verify_email.salutation'));
    }
}
