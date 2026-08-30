<?php

namespace App\Services\Sleep;

use App\Models\Baby;
use Carbon\CarbonImmutable;

/**
 * A deliberately simple, honest estimate - not machine learning. It looks
 * at the baby's own recent completed sleeps and predicts the next sleep
 * (or wake-up) as a rolling average of that baby's own history, the same
 * idea behind Huckleberry's "SweetSpot" but without any age-based model or
 * external dataset: below the minimum sample size it says so instead of
 * guessing.
 */
class SleepPatternPredictor
{
    private const MIN_SAMPLE_SIZE = 3;

    private const MAX_LOOKBACK = 20;

    /** Gaps longer than this are treated as an overnight stretch, not a nap-to-nap wake window. */
    private const MAX_WAKE_WINDOW_HOURS = 6;

    /**
     * @return array<string, mixed>
     */
    public static function predict(Baby $baby): array
    {
        $sleeps = $baby->sleeps()
            ->orderByDesc('started_at')
            ->limit(self::MAX_LOOKBACK)
            ->get()
            ->sortBy('started_at')
            ->values();

        $completed = $sleeps->filter(fn ($sleep) => $sleep->ended_at !== null)->values();

        if ($completed->count() < self::MIN_SAMPLE_SIZE) {
            return [
                'has_enough_data' => false,
                'sample_size' => $completed->count(),
                'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
                'average_sleep_duration_minutes' => null,
                'average_wake_window_minutes' => null,
                'prediction' => null,
            ];
        }

        $durations = $completed->map(
            fn ($sleep) => CarbonImmutable::parse($sleep->started_at)->diffInMinutes(CarbonImmutable::parse($sleep->ended_at))
        );
        $averageDurationMinutes = (int) round($durations->avg());

        $wakeWindows = [];
        for ($i = 1; $i < $completed->count(); $i++) {
            $previousEnd = CarbonImmutable::parse($completed[$i - 1]->ended_at);
            $nextStart = CarbonImmutable::parse($completed[$i]->started_at);
            $gapMinutes = $previousEnd->diffInMinutes($nextStart, absolute: false);

            if ($gapMinutes > 0 && $gapMinutes <= self::MAX_WAKE_WINDOW_HOURS * 60) {
                $wakeWindows[] = $gapMinutes;
            }
        }

        $averageWakeWindowMinutes = count($wakeWindows) > 0
            ? (int) round(array_sum($wakeWindows) / count($wakeWindows))
            : null;

        $latestSleep = $sleeps->last();
        $isOngoing = $latestSleep->ended_at === null;

        if ($isOngoing) {
            $prediction = [
                'type' => 'wake_up',
                'at' => CarbonImmutable::parse($latestSleep->started_at)->addMinutes($averageDurationMinutes)->toIso8601String(),
                'based_on' => 'average_sleep_duration',
            ];
        } elseif ($averageWakeWindowMinutes !== null) {
            $prediction = [
                'type' => 'next_sleep',
                'at' => CarbonImmutable::parse($latestSleep->ended_at)->addMinutes($averageWakeWindowMinutes)->toIso8601String(),
                'based_on' => 'average_wake_window',
            ];
        } else {
            $prediction = null;
        }

        return [
            'has_enough_data' => true,
            'sample_size' => $completed->count(),
            'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
            'average_sleep_duration_minutes' => $averageDurationMinutes,
            'average_wake_window_minutes' => $averageWakeWindowMinutes,
            'prediction' => $prediction,
        ];
    }
}
