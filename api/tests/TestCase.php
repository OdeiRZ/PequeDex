<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Las peticiones de test de Symfony traen `Accept-Language: en-us` por
        // defecto, y el API contesta en el idioma que pide el cliente (ver
        // SetLocaleFromRequest). La app real siempre manda el suyo; aquí es el
        // español, que es el idioma por defecto del API. Cada test que quiera
        // otro lo pide con `withHeader('Accept-Language', 'en')`.
        $this->withHeader('Accept-Language', 'es');
    }
}
