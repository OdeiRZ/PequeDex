<?php

namespace App\Http\Controllers\GrowthMeasurements;

use App\Http\Controllers\Controller;
use App\Http\Requests\GrowthMeasurements\StoreGrowthMeasurementRequest;
use App\Http\Requests\GrowthMeasurements\UpdateGrowthMeasurementRequest;
use App\Models\Baby;
use App\Models\GrowthMeasurement;
use App\Services\Growth\WhoGrowthStandards;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class GrowthMeasurementController extends Controller
{
    public function index(Baby $baby): JsonResponse
    {
        $this->authorize('view', $baby);

        $measurements = $baby->growthMeasurements()->orderByDesc('measured_at')->get();

        return response()->json(['data' => $measurements->map(fn ($m) => $this->withPercentiles($m, $baby))]);
    }

    public function store(StoreGrowthMeasurementRequest $request, Baby $baby): JsonResponse
    {
        $this->authorize('update', $baby);

        $measurement = $baby->growthMeasurements()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->withPercentiles($measurement, $baby)], 201);
    }

    public function update(UpdateGrowthMeasurementRequest $request, Baby $baby, int $growthMeasurement): JsonResponse
    {
        $this->authorize('update', $baby);

        $measurement = $baby->growthMeasurements()->findOrFail($growthMeasurement);
        $measurement->update($request->validated());

        return response()->json(['data' => $this->withPercentiles($measurement, $baby)]);
    }

    public function destroy(Baby $baby, int $growthMeasurement): JsonResponse
    {
        $this->authorize('update', $baby);

        $baby->growthMeasurements()->findOrFail($growthMeasurement)->delete();

        return response()->json(status: 204);
    }

    /**
     * Percentiles need the baby's sex and age at measured_at - both are
     * optional at the Baby level (see the babies.sex/birth_date migrations'
     * own comments), so this degrades to nulls rather than an error when
     * either is missing, same as WhoGrowthStandards::percentile() itself
     * degrading to null outside its own 0-24 month reference range.
     *
     * @return array<string, mixed>
     */
    private function withPercentiles(GrowthMeasurement $measurement, Baby $baby): array
    {
        $data = $measurement->toArray();
        $data['weight_percentile'] = null;
        $data['height_percentile'] = null;
        $data['head_circumference_percentile'] = null;

        if ($baby->sex === null || $baby->birth_date === null) {
            return $data;
        }

        // WHO's own reference tables are built against a fixed 30.4375-day
        // average month, not calendar months - matching that (rather than
        // Carbon's own calendar-based diffInMonths) is what keeps this
        // consistent with the LMS tables it's being compared against.
        $ageInMonths = Carbon::parse($baby->birth_date)->diffInDays(Carbon::parse($measurement->measured_at)) / 30.4375;
        $sex = $baby->sex->whoTableKey();

        if ($measurement->weight_grams !== null) {
            $data['weight_percentile'] = WhoGrowthStandards::percentile('weight', $sex, $ageInMonths, $measurement->weight_grams / 1000);
        }

        if ($measurement->height_cm !== null) {
            $data['height_percentile'] = WhoGrowthStandards::percentile('height', $sex, $ageInMonths, $measurement->height_cm);
        }

        if ($measurement->head_circumference_cm !== null) {
            $data['head_circumference_percentile'] = WhoGrowthStandards::percentile('head_circumference', $sex, $ageInMonths, $measurement->head_circumference_cm);
        }

        return $data;
    }
}
