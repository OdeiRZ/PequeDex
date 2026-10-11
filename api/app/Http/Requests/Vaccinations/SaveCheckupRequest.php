<?php

namespace App\Http\Requests\Vaccinations;

use App\Http\Requests\Concerns\AuthorizesBabyAccess;
use App\Http\Requests\Concerns\HasDateFieldMessages;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Una revisión puede estar en el futuro (la próxima cita) - a diferencia
 * del resto de registros, no se limita a "ya pasado".
 */
class SaveCheckupRequest extends FormRequest
{
    use AuthorizesBabyAccess;
    use HasDateFieldMessages;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'scheduled_at' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->dateFieldMessages('scheduled_at', 'la fecha de la revisión');
    }
}
