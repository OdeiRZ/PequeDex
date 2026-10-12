<?php

namespace App\Http\Requests\Stats;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The PDF export doesn't recompute anything server-side - it just
 * renders whatever StatsView.vue already computed and sends along.
 * Hour-bucket/day-boundary math needs the caregiver's own local
 * timezone (see `lib/stats.ts`'s own comment on this), which Laravel
 * has no way to know; the alternative (recomputing in PHP against a
 * guessed timezone) would silently disagree with what's on screen.
 * Same `authorize()` pattern as the Store/Update requests
 * (`AuthorizesBabyAccess`), checking `view` instead of `update` - this
 * is read-only, like `ContractionsExportController::show()`'s own
 * `$this->authorize('view', $baby)`.
 */
class ExportStatsRequest extends FormRequest
{
    public function authorize(): bool
    {
        $baby = $this->route('baby');

        return $baby !== null && $this->user()->can('view', $baby);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $hourBucketKey = Rule::in(['dawn', 'morning', 'afternoon', 'night']);

        return [
            // Periodo que cubren tomas/sueño/pañales (ver `StatsPeriod`
            // en `lib/stats.ts`); el resto de bloques no dependen de él.
            'period' => ['required', Rule::in(['7d', '14d', '30d', 'all'])],
            // "full" = el PDF de siempre; "summary" = el resumen de una
            // página para la consulta (últimos 14 días), con su recuadro
            // de preguntas y las temperaturas altas del periodo.
            'mode' => ['sometimes', Rule::in(['full', 'summary'])],
            'questions' => ['nullable', 'string', 'max:1000'],
            'high_temperatures' => ['sometimes', 'array', 'max:10'],
            'high_temperatures.*.celsius' => ['required', 'numeric'],
            'high_temperatures.*.at' => ['required', 'date'],
            // Diferencias frente al periodo anterior (`null` con "Todo");
            // cada una `null` si alguno de los dos periodos no tiene el dato.
            'period_deltas' => ['nullable', 'array'],
            'period_deltas.longest_stretch_minutes' => ['nullable', 'numeric'],
            'period_deltas.total_sleep_minutes' => ['nullable', 'numeric'],
            'period_deltas.feeds_per_day' => ['nullable', 'numeric'],
            'period_deltas.pee_per_day' => ['nullable', 'numeric'],
            'period_deltas.poop_per_day' => ['nullable', 'numeric'],

            'sleep' => ['required', 'array'],
            'sleep.has_enough_data' => ['required', 'boolean'],
            'sleep.average_duration_minutes' => ['nullable', 'numeric'],
            'sleep.average_wake_window_minutes' => ['nullable', 'numeric'],
            'sleep.average_sleeps_per_day' => ['nullable', 'numeric', 'min:0'],
            'sleep.average_longest_stretch_minutes' => ['nullable', 'numeric', 'min:0'],
            'sleep.by_hour_bucket' => ['required', 'array', 'size:4'],
            'sleep.by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'sleep.by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],
            'sleep.average_night_sleep_minutes' => ['nullable', 'numeric', 'min:0'],
            'sleep.average_day_sleep_minutes' => ['nullable', 'numeric', 'min:0'],
            'sleep.average_total_sleep_minutes' => ['nullable', 'numeric', 'min:0'],
            'sleep.longest_sleep' => ['nullable', 'array'],
            'sleep.longest_sleep.minutes' => ['required_with:sleep.longest_sleep', 'integer', 'min:0'],
            'sleep.longest_sleep.date' => ['required_with:sleep.longest_sleep', 'date'],

            'feed' => ['required', 'array'],
            'feed.has_enough_data' => ['required', 'boolean'],
            'feed.total' => ['required', 'integer', 'min:0'],
            'feed.by_type.pecho' => ['required', 'integer', 'min:0'],
            'feed.by_type.biberon' => ['required', 'integer', 'min:0'],
            'feed.by_type.solido' => ['required', 'integer', 'min:0'],
            'feed.pecho_side_counts.izquierdo' => ['required', 'integer', 'min:0'],
            'feed.pecho_side_counts.derecho' => ['required', 'integer', 'min:0'],
            'feed.pecho_side_counts.ambos' => ['required', 'integer', 'min:0'],
            'feed.average_bottle_amount_ml' => ['nullable', 'numeric'],
            'feed.average_pecho_duration_minutes' => ['nullable', 'numeric'],
            'feed.average_gap_minutes' => ['nullable', 'numeric'],
            'feed.average_per_day' => ['nullable', 'numeric'],
            'feed.by_hour_bucket' => ['required', 'array', 'size:4'],
            'feed.by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'feed.by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],
            'feed.gap_std_dev_minutes' => ['nullable', 'numeric', 'min:0'],

            'diaper' => ['required', 'array'],
            'diaper.has_enough_data' => ['required', 'boolean'],
            'diaper.total' => ['required', 'integer', 'min:0'],
            'diaper.by_size' => ['required', 'array'],
            'diaper.average_per_day' => ['nullable', 'numeric'],
            'diaper.average_pee_per_day' => ['nullable', 'numeric', 'min:0'],
            'diaper.average_poop_per_day' => ['nullable', 'numeric', 'min:0'],
            'diaper.average_gap_minutes' => ['nullable', 'numeric', 'min:0'],
            'diaper.by_hour_bucket' => ['required', 'array', 'size:4'],
            'diaper.by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'diaper.by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],
            'diaper.poop_colors' => ['required', 'array'],
            'diaper.poop_colors.verde' => ['required', 'integer', 'min:0'],
            'diaper.poop_colors.amarillo' => ['required', 'integer', 'min:0'],
            'diaper.poop_colors.marron' => ['required', 'integer', 'min:0'],
            'diaper.poop_colors.meconio' => ['required', 'integer', 'min:0'],
            'diaper.poop_colors.unspecified' => ['required', 'integer', 'min:0'],
            'diaper.last_poop_at' => ['nullable', 'date'],

            'growth' => ['required', 'array'],
            ...$this->growthMetricRules('growth.weight_kg'),
            ...$this->growthMetricRules('growth.height_cm'),
            ...$this->growthMetricRules('growth.head_circumference_cm'),

            // "Esta semana completa frente a la anterior" - `nullable`
            // en el propio array: con menos de dos semanas completas
            // con dato (ver `summarizeWeekComparison()` en
            // `lib/stats.ts`) no hay comparación que mostrar.
            'week_comparison' => ['nullable', 'array'],
            'week_comparison.sleep_hours' => ['nullable', 'array'],
            'week_comparison.sleep_hours.current' => ['required_with:week_comparison.sleep_hours', 'numeric'],
            'week_comparison.sleep_hours.delta' => ['required_with:week_comparison.sleep_hours', 'numeric'],
            'week_comparison.feed_count' => ['required_with:week_comparison', 'array'],
            'week_comparison.feed_count.current' => ['required_with:week_comparison', 'integer', 'min:0'],
            'week_comparison.feed_count.delta' => ['required_with:week_comparison', 'numeric'],
            'week_comparison.diaper_count' => ['required_with:week_comparison', 'array'],
            'week_comparison.diaper_count.current' => ['required_with:week_comparison', 'integer', 'min:0'],
            'week_comparison.diaper_count.delta' => ['required_with:week_comparison', 'numeric'],

            // "Tendencia semanal" y "Mapa de actividad" en el PDF -
            // mismos arrays que ya pinta WeeklyTrendChart.vue/
            // ActivityHeatmap.vue en pantalla (`present`, no `required`:
            // un bebé recién creado, sin historial, manda un array
            // vacío - un estado válido, no una clave ausente).
            'weekly_trend' => ['present', 'array'],
            'weekly_trend.*.week_start' => ['required', 'date'],
            'weekly_trend.*.sleep_hours' => ['nullable', 'numeric', 'min:0'],
            'weekly_trend.*.longest_stretch_minutes' => ['nullable', 'numeric', 'min:0'],
            'weekly_trend.*.feed_count' => ['required', 'integer', 'min:0'],
            'weekly_trend.*.diaper_count' => ['required', 'integer', 'min:0'],

            // `null` si el bebé nunca ha tenido una temperatura registrada.
            'temperature' => ['nullable', 'array'],
            'temperature.count' => ['required_with:temperature', 'integer', 'min:0'],
            'temperature.high_count' => ['required_with:temperature', 'integer', 'min:0'],
            'temperature.max' => ['nullable', 'array'],
            'temperature.max.celsius' => ['required_with:temperature.max', 'numeric'],
            'temperature.max.at' => ['required_with:temperature.max', 'date'],
            'temperature.latest' => ['nullable', 'array'],
            'temperature.latest.celsius' => ['required_with:temperature.latest', 'numeric'],
            'temperature.latest.at' => ['required_with:temperature.latest', 'date'],
            // Para la gráfica del periodo (como mucho 200 mediciones).
            'temperature.readings' => ['sometimes', 'array', 'max:200'],
            'temperature.readings.*.celsius' => ['required', 'numeric'],
            'temperature.readings.*.at' => ['required', 'date'],
            'temperature.from' => ['nullable', 'date'],

            // `null` si "Vacunas y revisiones" no está activado para el bebé.
            'vaccinations' => ['nullable', 'array'],
            'vaccinations.given' => ['required_with:vaccinations', 'integer', 'min:0'],
            'vaccinations.total' => ['required_with:vaccinations', 'integer', 'min:0'],
            'vaccinations.overdue' => ['required_with:vaccinations', 'integer', 'min:0'],
            'vaccinations.given_list' => ['present_with:vaccinations', 'array'],
            'vaccinations.given_list.*.name' => ['required', 'string', 'max:255'],
            'vaccinations.given_list.*.date' => ['required', 'date'],
            'vaccinations.upcoming_list' => ['present_with:vaccinations', 'array', 'max:5'],
            'vaccinations.upcoming_list.*.name' => ['required', 'string', 'max:255'],
            'vaccinations.upcoming_list.*.date' => ['nullable', 'date'],
            'vaccinations.next_checkup' => ['nullable', 'array'],
            'vaccinations.next_checkup.reason' => ['nullable', 'string', 'max:255'],
            'vaccinations.next_checkup.at' => ['required_with:vaccinations.next_checkup', 'date'],

            'activity_heatmap' => ['present', 'array'],
            'activity_heatmap.*.day_of_week' => ['required', 'integer', 'min:0', 'max:6'],
            'activity_heatmap.*.hour' => ['required', 'integer', 'min:0', 'max:23'],
            'activity_heatmap.*.count' => ['required', 'integer', 'min:0'],

            // `required` (not just `present`): buildStatsExportPayload()
            // always sends this object, with has_schedule:false standing
            // in for "never activated" - unlike weekly_trend/
            // activity_heatmap above, this is never an empty array.
            'vitamin_d' => ['required', 'array'],
            'vitamin_d.has_schedule' => ['required', 'boolean'],
            'vitamin_d.given' => ['required', 'integer', 'min:0'],
            'vitamin_d.total_days' => ['required', 'integer', 'min:0'],

            // Antes vivía en el Dashboard (WeeklySleep.vue) - siempre 7
            // días de calendario, `present` no `required`: un bebé sin
            // ningún sueño registrado todavía manda igualmente las 7
            // entradas, solo con `hours: 0` cada una (nunca un array
            // vacío, a diferencia de weekly_trend/activity_heatmap).
            'weekly_sleep_by_day' => ['present', 'array'],
            'weekly_sleep_by_day.*.date' => ['required', 'date'],
            'weekly_sleep_by_day.*.hours' => ['required', 'numeric', 'min:0'],

            // Referencias de sueño por edad (web/src/lib/sleepReference.ts),
            // calculadas en el móvil como el resto. Opcional: un cliente
            // anterior no la manda, y sin fecha de nacimiento va a null.
            'sleep_reference' => ['nullable', 'array'],
            'sleep_reference.total' => ['nullable', 'array'],
            'sleep_reference.total.min' => ['required_with:sleep_reference.total', 'numeric', 'min:0'],
            'sleep_reference.total.max' => ['required_with:sleep_reference.total', 'numeric', 'min:0'],
            'sleep_reference.total.source' => ['required_with:sleep_reference.total', Rule::in(['nsf', 'aasm'])],
            'sleep_reference.total.verdict' => ['nullable', Rule::in(['below', 'within', 'above'])],
            'sleep_reference.wake_window' => ['nullable', 'array'],
            'sleep_reference.wake_window.min' => ['required_with:sleep_reference.wake_window', 'numeric', 'min:0'],
            'sleep_reference.wake_window.max' => ['required_with:sleep_reference.wake_window', 'numeric', 'min:0'],
            'sleep_reference.wake_window.verdict' => ['nullable', Rule::in(['below', 'within', 'above'])],
        ];
    }

    /**
     * Same shape three times over (weight/height/head) - generated once
     * instead of copy-pasted, same reasoning as `growthMetrics` in
     * `StatsView.vue` driving its own three blocks from one table.
     *
     * @return array<string, mixed>
     */
    private function growthMetricRules(string $prefix): array
    {
        return [
            "$prefix" => ['required', 'array'],
            // `present`, not `required` - Laravel's `required` treats an
            // empty array as "not filled", but no measurements logged
            // for this metric yet is a real, valid state (an empty
            // `points` array, not a missing key).
            "$prefix.points" => ['present', 'array'],
            "$prefix.points.*.date" => ['required', 'date'],
            "$prefix.points.*.value" => ['required', 'numeric'],
            "$prefix.points.*.percentile" => ['nullable', 'numeric'],
            "$prefix.latest_value" => ['nullable', 'numeric'],
            "$prefix.latest_percentile" => ['nullable', 'numeric'],
            "$prefix.gained" => ['nullable', 'numeric'],
            "$prefix.weekly_rate" => ['nullable', 'numeric'],
            "$prefix.count" => ['required', 'integer', 'min:0'],
        ];
    }
}
