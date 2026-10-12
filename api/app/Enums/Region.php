<?php

namespace App\Enums;

/**
 * Comunidades y ciudades autónomas. Decide qué plantilla de vacunas se
 * aplica (ver App\Services\Vaccinations\VaccinationTemplates): cada una
 * tiene su fichero en resources/vaccination-templates (recopilados en
 * 2026); sin comunidad indicada se usa el calendario común.
 */
enum Region: string
{
    case Andalucia = 'andalucia';
    case Aragon = 'aragon';
    case Asturias = 'asturias';
    case Baleares = 'baleares';
    case Canarias = 'canarias';
    case Cantabria = 'cantabria';
    case CastillaLaMancha = 'castilla_la_mancha';
    case CastillaYLeon = 'castilla_y_leon';
    case Cataluna = 'cataluna';
    case Ceuta = 'ceuta';
    case ComunidadValenciana = 'comunidad_valenciana';
    case Extremadura = 'extremadura';
    case Galicia = 'galicia';
    case LaRioja = 'la_rioja';
    case Madrid = 'madrid';
    case Melilla = 'melilla';
    case Murcia = 'murcia';
    case Navarra = 'navarra';
    case PaisVasco = 'pais_vasco';
}
