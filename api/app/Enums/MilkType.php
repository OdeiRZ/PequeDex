<?php

namespace App\Enums;

/**
 * Only meaningful for FeedType::Pecho - see StoreFeedRequest/UpdateFeedRequest
 * for the prohibited_unless rule that keeps this null for biberon/solido.
 */
enum MilkType: string
{
    case Calostro = 'calostro';
    case Leche = 'leche';
}
