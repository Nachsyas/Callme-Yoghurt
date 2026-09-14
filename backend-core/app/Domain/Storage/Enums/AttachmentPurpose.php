<?php

declare(strict_types=1);

namespace App\Domain\Storage\Enums;

enum AttachmentPurpose: string
{
    case PRODUCT_IMAGE = 'PRODUCT_IMAGE';
    case INVOICE_PDF = 'INVOICE_PDF';
    case COMPLAINT_EVIDENCE = 'COMPLAINT_EVIDENCE';
}
