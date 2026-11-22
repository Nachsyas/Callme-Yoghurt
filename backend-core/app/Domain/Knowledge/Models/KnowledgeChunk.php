<?php

declare(strict_types=1);

namespace App\Domain\Knowledge\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KnowledgeChunk extends Model
{
    use HasUuids;

    protected $table = 'knowledge_chunks';

    protected $fillable = [
        'knowledge_document_id',
        'chunk_index',
        'content',
        'token_count',
    ];

    /**
     * Attributes cast to native types.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'chunk_index' => 'integer',
            'token_count' => 'integer',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(KnowledgeDocument::class, 'knowledge_document_id');
    }
}
