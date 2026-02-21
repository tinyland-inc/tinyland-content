/**
 * Offer Builder Service
 *
 * Builds schema.org Offer objects from product transaction configurations.
 * Used for commerce federation and product page structured data.
 *
 * This is a framework-agnostic extraction that replaces the monorepo's
 * `$lib/server/services/OfferBuilderService.ts`.
 *
 * @module services/OfferBuilderService
 */

import { getLogger, withSpan } from '../config.js';

// ============================================================================
// Types
// ============================================================================

export type OfferAvailability =
  | 'InStock'
  | 'OutOfStock'
  | 'PreOrder'
  | 'SoldOut'
  | 'OnlineOnly'
  | 'LimitedAvailability'
  | 'Discontinued';

export type PaymentMethod =
  | 'Cash'
  | 'CreditCard'
  | 'Cryptocurrency'
  | 'BankTransfer'
  | 'PaymentService'
  | 'Subscription'
  | 'Donation'
  | 'Exchange';

export interface PriceSpecification {
  '@type': 'PriceSpecification' | 'UnitPriceSpecification';
  price: number | string;
  priceCurrency: string;
  valueAddedTaxIncluded?: boolean;
  validFrom?: string;
  validThrough?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface SchemaOffer {
  '@context': 'https://schema.org';
  '@type': 'Offer';
  '@id': string;
  name: string;
  description?: string;
  url?: string;
  price?: number | string;
  priceCurrency?: string;
  priceSpecification?: PriceSpecification;
  availability: OfferAvailability;
  availabilityStarts?: string;
  availabilityEnds?: string;
  seller?: {
    '@type': 'Person' | 'Organization';
    name: string;
    url?: string;
  };
  itemOffered?: {
    '@type': 'Product' | 'Service' | 'CreativeWork';
    name: string;
    description?: string;
    url?: string;
    image?: string;
  };
  acceptedPaymentMethod?: PaymentMethod[];
  transactionType: string;
  externalUrl?: string;
  requiresAction?: string;
}

export interface TransactionConfig {
  type: string;
  enabled: boolean;
  url?: string;
  label?: string;
  description?: string;
  priority?: number;
  price?: number | string;
  currency?: string;
  availability?: OfferAvailability;
}

export interface TransactionMapping {
  transactionType: string;
  schemaType: 'Offer' | 'DonateAction' | 'BuyAction' | 'ReserveAction';
  paymentMethods: PaymentMethod[];
  defaultAvailability: OfferAvailability;
  requiresExternalUrl: boolean;
  isMonetary: boolean;
  isCryptocurrency: boolean;
  isSubscription: boolean;
  isDonation: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Minimal content item interface for offer building */
export interface OfferContentItem {
  slug: string;
  title?: string;
  frontmatter: Record<string, unknown>;
}

// ============================================================================
// Transaction Mappings
// ============================================================================

/**
 * Mapping configuration for all 15 transaction types
 */
export const TRANSACTION_MAPPINGS: Record<string, TransactionMapping> = {
  inquiry: {
    transactionType: 'inquiry',
    schemaType: 'Offer',
    paymentMethods: [],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: false,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  ebay: {
    transactionType: 'ebay',
    schemaType: 'Offer',
    paymentMethods: ['CreditCard', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  etsy: {
    transactionType: 'etsy',
    schemaType: 'Offer',
    paymentMethods: ['CreditCard', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  amazon: {
    transactionType: 'amazon',
    schemaType: 'Offer',
    paymentMethods: ['CreditCard', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  'snail-mail': {
    transactionType: 'snail-mail',
    schemaType: 'Offer',
    paymentMethods: ['Cash', 'BankTransfer'],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  monero: {
    transactionType: 'monero',
    schemaType: 'Offer',
    paymentMethods: ['Cryptocurrency'],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: true,
    isCryptocurrency: true,
    isSubscription: false,
    isDonation: false,
  },
  stripe: {
    transactionType: 'stripe',
    schemaType: 'Offer',
    paymentMethods: ['CreditCard', 'PaymentService'],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  polar: {
    transactionType: 'polar',
    schemaType: 'Offer',
    paymentMethods: ['Subscription', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: true,
    isDonation: false,
  },
  talar: {
    transactionType: 'talar',
    schemaType: 'Offer',
    paymentMethods: ['BankTransfer', 'PaymentService'],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  repository: {
    transactionType: 'repository',
    schemaType: 'Offer',
    paymentMethods: [],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: false,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  documentation: {
    transactionType: 'documentation',
    schemaType: 'Offer',
    paymentMethods: [],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: false,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  booking: {
    transactionType: 'booking',
    schemaType: 'ReserveAction',
    paymentMethods: ['PaymentService', 'CreditCard'],
    defaultAvailability: 'LimitedAvailability',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
  liberapay: {
    transactionType: 'liberapay',
    schemaType: 'DonateAction',
    paymentMethods: ['Donation', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: true,
    isDonation: true,
  },
  kofi: {
    transactionType: 'kofi',
    schemaType: 'DonateAction',
    paymentMethods: ['Donation', 'PaymentService'],
    defaultAvailability: 'OnlineOnly',
    requiresExternalUrl: true,
    isMonetary: true,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: true,
  },
  'contribute-to-consume': {
    transactionType: 'contribute-to-consume',
    schemaType: 'Offer',
    paymentMethods: ['Exchange'],
    defaultAvailability: 'InStock',
    requiresExternalUrl: false,
    isMonetary: false,
    isCryptocurrency: false,
    isSubscription: false,
    isDonation: false,
  },
};

// ============================================================================
// Offer Builder Service
// ============================================================================

export class OfferBuilderService {
  /**
   * Build schema.org Offer from transaction config
   */
  buildOffer(
    product: OfferContentItem,
    transaction: TransactionConfig,
    baseUrl: string
  ): SchemaOffer {
    return withSpan('OfferBuilderService.buildOffer', () => {
      const mapping = TRANSACTION_MAPPINGS[transaction.type];
      if (!mapping) {
        throw new Error(`Unknown transaction type: ${transaction.type}`);
      }

      const fm = product.frontmatter;
      const productName = (fm.name as string) || product.title || product.slug;
      const offerId = `${baseUrl}/products/${product.slug}#offer-${transaction.type}`;

      const priceSpec =
        mapping.isMonetary && transaction.price
          ? this.buildPriceSpec(
              transaction.price,
              transaction.currency || 'USD',
              mapping
            )
          : undefined;

      const availability = transaction.availability || mapping.defaultAvailability;

      const offer: SchemaOffer = {
        '@context': 'https://schema.org',
        '@type': 'Offer',
        '@id': offerId,
        name: transaction.label || `${productName} - ${transaction.type}`,
        description: transaction.description,
        url: transaction.url || `${baseUrl}/products/${product.slug}`,
        availability,
        acceptedPaymentMethod: mapping.paymentMethods,
        transactionType: transaction.type,
      };

      if (mapping.isMonetary && transaction.price) {
        offer.price = transaction.price;
        offer.priceCurrency = transaction.currency || 'USD';
        offer.priceSpecification = priceSpec;
      }

      if (transaction.url) {
        offer.externalUrl = transaction.url;
      }

      offer.seller = {
        '@type': 'Organization',
        name: 'Tinyland',
        url: baseUrl,
      };

      offer.itemOffered = {
        '@type': 'Product',
        name: productName,
        description: fm.description as string | undefined,
        url: `${baseUrl}/products/${product.slug}`,
        image: fm.image as string | undefined,
      };

      if (!mapping.isMonetary) {
        offer.requiresAction = this.getRequiredAction(transaction.type);
      }

      return offer;
    });
  }

  /**
   * Build all Offers for a product
   */
  buildAllOffers(product: OfferContentItem, baseUrl: string): SchemaOffer[] {
    return withSpan('OfferBuilderService.buildAllOffers', () => {
      const fm = product.frontmatter;
      const transactions = (fm.transactions as TransactionConfig[]) || [];

      const enabledTransactions = transactions
        .filter((t) => t.enabled)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      return enabledTransactions.map((t) =>
        this.buildOffer(product, t, baseUrl)
      );
    });
  }

  /**
   * Convert Offer to ActivityPub attachment
   */
  offerToActivityPubAttachment(offer: SchemaOffer): {
    type: 'PropertyValue';
    name: string;
    value: string;
  } {
    const mapping = TRANSACTION_MAPPINGS[offer.transactionType];
    let value = offer.name;

    if (mapping?.isMonetary && offer.price) {
      value += ` - ${offer.price} ${offer.priceCurrency}`;
    }

    if (offer.externalUrl) {
      value += ` (${offer.externalUrl})`;
    }

    return {
      type: 'PropertyValue',
      name: this.getTransactionDisplayName(offer.transactionType),
      value,
    };
  }

  /**
   * Build price specification
   */
  private buildPriceSpec(
    price: number | string,
    currency: string,
    mapping: TransactionMapping
  ): PriceSpecification {
    const priceValue = typeof price === 'string' ? parseFloat(price) : price;

    const spec: PriceSpecification = {
      '@type': mapping.isCryptocurrency
        ? 'UnitPriceSpecification'
        : 'PriceSpecification',
      price: priceValue,
      priceCurrency: currency,
    };

    if (!mapping.isCryptocurrency) {
      spec.valueAddedTaxIncluded = false;
    }

    return spec;
  }

  /**
   * Get payment methods for transaction type
   */
  getPaymentMethods(transactionType: string): PaymentMethod[] {
    const mapping = TRANSACTION_MAPPINGS[transactionType];
    return mapping?.paymentMethods || [];
  }

  /**
   * Validate transaction configuration
   */
  validateTransaction(transaction: TransactionConfig): ValidationResult {
    const errors: string[] = [];

    const mapping = TRANSACTION_MAPPINGS[transaction.type];
    if (!mapping) {
      errors.push(`Unknown transaction type: ${transaction.type}`);
      return { valid: false, errors };
    }

    if (mapping.requiresExternalUrl && !transaction.url) {
      errors.push(
        `Transaction type "${transaction.type}" requires an external URL`
      );
    }

    if (transaction.url) {
      try {
        new URL(transaction.url);
      } catch {
        errors.push(`Invalid URL format: ${transaction.url}`);
      }
    }

    if (mapping.isMonetary && !transaction.price) {
      errors.push(
        `Monetary transaction type "${transaction.type}" requires a price`
      );
    }

    if (transaction.price !== undefined) {
      const priceValue =
        typeof transaction.price === 'string'
          ? parseFloat(transaction.price)
          : transaction.price;

      if (isNaN(priceValue) || priceValue < 0) {
        errors.push(`Invalid price: ${transaction.price}`);
      }
    }

    if (mapping.isMonetary && transaction.currency) {
      const validCurrencies = [
        'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'XMR', 'BTC', 'ETH',
      ];
      if (!validCurrencies.includes(transaction.currency)) {
        errors.push(
          `Invalid currency: ${transaction.currency}. Must be one of: ${validCurrencies.join(', ')}`
        );
      }
    }

    if (mapping.isCryptocurrency && transaction.currency) {
      const cryptoCurrencies = ['XMR', 'BTC', 'ETH'];
      if (!cryptoCurrencies.includes(transaction.currency)) {
        errors.push(
          `Cryptocurrency transaction requires crypto currency (XMR, BTC, ETH), got: ${transaction.currency}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get required action hint for non-monetary transactions
   */
  private getRequiredAction(transactionType: string): string {
    const actions: Record<string, string> = {
      inquiry: 'contact',
      repository: 'view-source',
      documentation: 'read-docs',
      'contribute-to-consume': 'contribute',
    };
    return actions[transactionType] || 'visit';
  }

  /**
   * Get display name for transaction type
   */
  private getTransactionDisplayName(transactionType: string): string {
    const names: Record<string, string> = {
      inquiry: 'Contact',
      ebay: 'eBay',
      etsy: 'Etsy',
      amazon: 'Amazon',
      'snail-mail': 'Mail Order',
      monero: 'Monero',
      stripe: 'Credit Card',
      polar: 'Polar Subscription',
      talar: 'GNU Taler',
      repository: 'Source Code',
      documentation: 'Documentation',
      booking: 'Book Appointment',
      liberapay: 'Liberapay',
      kofi: 'Ko-fi',
      'contribute-to-consume': 'Contribute to Access',
    };
    return names[transactionType] || transactionType;
  }

  /**
   * Get all transaction types with metadata
   */
  getAllTransactionTypes(): Array<{
    type: string;
    displayName: string;
    isMonetary: boolean;
    isDonation: boolean;
    isSubscription: boolean;
    requiresExternalUrl: boolean;
  }> {
    return Object.entries(TRANSACTION_MAPPINGS).map(([type, mapping]) => ({
      type,
      displayName: this.getTransactionDisplayName(type),
      isMonetary: mapping.isMonetary,
      isDonation: mapping.isDonation,
      isSubscription: mapping.isSubscription,
      requiresExternalUrl: mapping.requiresExternalUrl,
    }));
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an OfferBuilderService instance.
 */
export function createOfferBuilder(): OfferBuilderService {
  return new OfferBuilderService();
}
