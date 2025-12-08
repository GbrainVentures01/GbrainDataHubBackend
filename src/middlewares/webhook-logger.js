/**
 * Webhook Logging Middleware
 * Logs all webhook events to webhook_logs table for audit trail
 */

module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    // Only process POST requests to webhook routes
    if (ctx.method !== 'POST' || !ctx.request.url.includes('/webhook')) {
      return next();
    }

    const startTime = Date.now();
    const ipAddress = ctx.request.ip || ctx.headers['x-forwarded-for'] || 'unknown';
    const userAgent = ctx.headers['user-agent'] || 'unknown';

    try {
      // Store original body
      const body = ctx.request.body;

      // Determine provider from URL
      let provider = 'unknown';
      if (ctx.request.url.includes('quidax')) provider = 'quidax';
      else if (ctx.request.url.includes('obiex')) provider = 'obiex';
      else if (ctx.request.url.includes('monnify')) provider = 'monnify';
      else if (ctx.request.url.includes('flutterwave')) provider = 'flutterwave';
      else if (ctx.request.url.includes('vtpass') || ctx.request.url.includes('vt-pass')) provider = 'vtpass';
      else if (ctx.request.url.includes('datahouse')) provider = 'datahouse';
      else if (ctx.request.url.includes('ogdams')) provider = 'ogdams';

      // Extract event type from payload
      const eventType = body?.event_type || body?.type || body?.event || 'unknown';
      const transactionId = body?.transaction_id || body?.id || body?.reference || undefined;

      // Proceed with the next middleware/handler
      await next();

      // Log successful webhook
      await strapi.db.query('api::webhook-log.webhook-log').create({
        data: {
          provider,
          event_type: eventType,
          payload: body,
          status: 'processed',
          transaction_id: transactionId,
          ip_address: ipAddress,
          user_agent: userAgent,
          processed_at: new Date(),
          retry_count: parseInt(ctx.headers['x-retry-count'] || '0'),
        },
      });

      console.log(
        `✅ Webhook logged: ${provider}/${eventType} (${Date.now() - startTime}ms)`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      try {
        // Log failed webhook processing
        await strapi.db.query('api::webhook-log.webhook-log').create({
          data: {
            provider: 'unknown',
            event_type: ctx.request.url,
            payload: ctx.request.body,
            status: 'failed',
            error_message: errorMessage,
            error_code: error.code || 'WEBHOOK_ERROR',
            ip_address: ipAddress,
            user_agent: userAgent,
            retry_count: parseInt(ctx.headers['x-retry-count'] || '0'),
          },
        });
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }

      console.error(
        `❌ Webhook error: ${errorMessage} (${Date.now() - startTime}ms)`
      );

      throw error;
    }
  };
};
