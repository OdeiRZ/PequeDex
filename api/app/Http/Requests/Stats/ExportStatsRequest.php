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
            'sleep' => ['required', 'array'],
            'sleep.has_enough_data' => ['required', 'boolean'],
            'sleep.total_completed' => ['required', 'integer', 'min:0'],
            'sleep.average_duration_minutes' => ['nullable', 'numeric'],
            'sleep.average_wake_window_minutes' => ['nullable', 'numeric'],
            'sleep.by_hour_bucket' => ['required', 'array', 'size:4'],
            'sleep.by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'sleep.by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],
            ...$this->clockTimeRules('sleep.typical_bedtime'),
            ...$this->clockTimeRules('sleep.typical_wake_time'),
            'sleep.average_night_sleep_minutes' => ['nullable', 'numeric', 'min:0'],
            'sleep.average_nap_minutes' => ['nullable', 'numeric', 'min:0'],
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
            'diaper.by_type.mojado' => ['required', 'integer', 'min:0'],
            'diaper.by_type.sucio' => ['required', 'integer', 'min:0'],
            'diaper.by_type.ambos' => ['required', 'integer', 'min:0'],
            'diaper.by_size' => ['required', 'array'],
            'diaper.average_per_day' => ['nullable', 'numeric'],
            'diaper.average_wet_per_day' => ['nullable', 'numeric'],
            'diaper.pee_by_hour_bucket' => ['required', 'array', 'size:4'],
            'diaper.pee_by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'diaper.pee_by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],
            'diaper.poop_by_hour_bucket' => ['required', 'array', 'size:4'],
            'diaper.poop_by_hour_bucket.*.key' => ['required', $hourBucketKey],
            'diaper.poop_by_hour_bucket.*.value' => ['required', 'numeric', 'min:0'],

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
            'weekly_trend.*.feed_count' => ['required', 'integer', 'min:0'],
            'weekly_trend.*.diaper_count' => ['required', 'integer', 'min:0'],

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
        ];
    }

    /**
     * "Horarios habituales" - una hora de reloj (`{hours, minutes}`),
     * no una fecha, calculada con una media circular sobre varios días
     * (ver `lib/stats.ts`). `nullable` en el propio array: por debajo
     * de 3 días distintos con dato no hay "hora típica" que mostrar -
     * mismo motivo por el que el resto de medias de esta plantilla
     * también son `nullable`. `required_with` en los dos campos
     * internos en vez de volverlos `nullable` también: si el array
     * llega, tiene que traer una hora real, no una mitad.
     *
     * @return array<string, mixed>
     */
    private function clockTimeRules(string $prefix): array
    {
        return [
            "$prefix" => ['nullable', 'array'],
            "$prefix.hours" => ["required_with:$prefix", 'integer', 'min:0', 'max:23'],
            "$prefix.minutes" => ["required_with:$prefix", 'integer', 'min:0', 'max:59'],
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
