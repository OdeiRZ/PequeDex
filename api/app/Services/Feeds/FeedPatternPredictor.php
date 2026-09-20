<?php

namespace App\Services\Feeds;

use App\Models\Baby;
use Carbon\CarbonImmutable;

/**
 * Same honest, no-ML estimate as SleepPatternPredictor - a rolling average
 * over the baby's own recent feeds, with no prediction at all below the
 * minimum sample size. Simpler than sleep: a feed is a single instant
 * (started_at), not an interval with its own duration and an "ongoing"
 * state, so there is only one thing to predict (the next feed time), not
 * two.
 */
class FeedPatternPredictor
{
    private const MIN_SAMPLE_SIZE = 3;

    private const MAX_LOOKBACK = 20;

    /**
     * A gap this long almost always means an overnight stretch (or a
     * genuinely missed log), not the baby's real feeding rhythm - included
     * in the average would drag the prediction hours off for the very next
     * (daytime) gap. Same reasoning as sleep's MAX_WAKE_WINDOW_HOURS, just
     * a wider window since feeds are typically closer together than naps.
     */
    private const MAX_GAP_HOURS = 8;

    /**
     * @return array<string, mixed>
     */
    public static function predict(Baby $baby): array
    {
        $feeds = $baby->feeds()
            ->orderByDesc('started_at')
            ->limit(self::MAX_LOOKBACK)
            ->get()
            ->sortBy('started_at')
            ->values();

        if ($feeds->count() < self::MIN_SAMPLE_SIZE) {
            return [
                'has_enough_data' => false,
                'sample_size' => $feeds->count(),
                'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
                'average_gap_minutes' => null,
                'prediction' => null,
            ];
        }

        $gaps = [];
        for ($i = 1; $i < $feeds->count(); $i++) {
            $previous = CarbonImmutable::parse($feeds[$i - 1]->started_at);
            $current = CarbonImmutable::parse($feeds[$i]->started_at);
            $gapMinutes = $previous->diffInMinutes($current, absolute: false);

            if ($gapMinutes > 0 && $gapMinutes <= self::MAX_GAP_HOURS * 60) {
                $gaps[] = $gapMinutes;
            }
        }

        if (count($gaps) === 0) {
            return [
                'has_enough_data' => true,
                'sample_size' => $feeds->count(),
                'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
                'average_gap_minutes' => null,
                'prediction' => null,
            ];
        }

        $averageGapMinutes = (int) round(array_sum($gaps) / count($gaps));
        $latestFeed = $feeds->last();

        return [
            'has_enough_data' => true,
            'sample_size' => $feeds->count(),
            'minimum_sample_size' => self::MIN_SAMPLE_SIZE,
            'average_gap_minutes' => $averageGapMinutes,
            'prediction' => [
                'type' => 'next_feed',
                'at' => CarbonImmutable::parse($latestFeed->started_at)->addMinutes($averageGapMinutes)->toIso8601String(),
                'based_on' => 'average_gap',
            ],
        ];
    }
}
