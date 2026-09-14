<?php

declare(strict_types=1);

namespace App\Domain\Knowledge\Models;

use App\Domain\Storage\Enums\DataClassification;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KnowledgeDocument extends Model
{
    use HasUuids;

    protected $table = 'knowledge_documents';

    protected $fillable = [
        'source_type',
        'source_reference',
        'title',
        'classification',
        'content_hash',
    ];

    /**
     * Attributes cast to native types.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'classification' => DataClassification::class,
        ];
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(KnowledgeChunk::class, 'knowledge_document_id');
    }
}
