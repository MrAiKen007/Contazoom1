import crypto from "crypto";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

// Constantes da API Shopee
export const SHOPEE_API_BASE = "https://partner.shopeemobile.com";
export const SHOPEE_PATH_TOKEN_GET = "/api/v2/auth/token/get";
export const SHOPEE_PATH_ACCESS_TOKEN_GET = "/api/v2/auth/access_token/get";
export const SHOPEE_PATH_SHOP_INFO = "/api/v2/shop/get_shop_info";
export const SHOPEE_PATH_ORDER_LIST = "/api/v2/order/get_order_list";
export const SHOPEE_PATH_ORDER_DETAIL = "/api/v2/order/get_order_detail";
export const SHOPEE_PATH_ESCROW_DETAIL = "/api/v2/payment/get_escrow_detail";

/**
 * Gera assinatura base para Shopee (usado em auth inicial)
 */
export function signShopeeBaseString(
  partnerId: string,
  partnerKey: string,
  path: string,
  timestamp: number
): string {
  const baseString = `${partnerId}${path}${timestamp}`;
  return crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");
}

/**
 * Gera URL de autorização para Shopee
 */
export function buildShopeeAuthUrl(req: NextRequest): string {
  const partnerId = process.env.SHOPEE_PARTNER_ID!;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY!;

  const redirectUrl = resolveShopeeCallbackUrl(req);
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = signShopeeBaseString(partnerId, partnerKey, path, timestamp);

  const url = new URL(`${SHOPEE_API_BASE}${path}`);
  url.searchParams.append("partner_id", partnerId);
  url.searchParams.append("timestamp", timestamp.toString());
  url.searchParams.append("sign", sign);
  url.searchParams.append("redirect", redirectUrl);

  return url.toString();
}

/**
 * Alias para compatibilidade
 */
export function getShopeeAuthUrl(
  partnerId: string,
  partnerKey: string,
  redirectUrl: string
): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopeeBaseString(partnerId, partnerKey, path, timestamp);

  const url = new URL(`${SHOPEE_API_BASE}${path}`);
  url.searchParams.append("partner_id", partnerId);
  url.searchParams.append("timestamp", timestamp.toString());
  url.searchParams.append("sign", sign);
  url.searchParams.append("redirect", redirectUrl);

  return url.toString();
}

/**
 * Resolve URL de callback da Shopee
 */
export function resolveShopeeCallbackUrl(req: NextRequest): string {
  const redirectOrigin = process.env.SHOPEE_REDIRECT_ORIGIN;

  if (redirectOrigin) {
    return `${redirectOrigin}/api/shopee/callback`;
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";

  return `${proto}://${host}/api/shopee/callback`;
}

/**
 * Resolve configurações de cookie (domain e secure)
 */
export function resolveShopeeCookieSettings(req: NextRequest): {
  domain?: string;
  secure: boolean;
} {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = req.headers.get("x-forwarded-proto") || "http";

  // Se estiver em produção ou usando HTTPS
  const secure = proto === "https";

  // Não definir domain para localhost/ngrok
  const domain = host.includes("localhost") || host.includes("ngrok")
    ? undefined
    : host.split(":")[0];

  return { domain, secure };
}

/**
 * Salva estado OAuth no banco
 */
export async function saveShopeeOauthState(
  userId: string,
  state: string,
  expiresAt: Date
): Promise<void> {
  await prisma.shopeeOauthState.create({
    data: {
      state,
      userId,
      expires_at: expiresAt,
    },
  });
}

/**
 * Deleta estado OAuth do banco
 */
export async function deleteShopeeOauthState(state: string): Promise<void> {
  await prisma.shopeeOauthState.deleteMany({
    where: { state },
  });
}

/**
 * Gera assinatura para requisições de API Shopee V2
 */
export function generateShopeeSign(
  partnerId: string,
  partnerKey: string,
  path: string,
  accessToken: string,
  shopId: string,
  timestamp: number
): string {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");
}

/**
 * Refresh token da Shopee
 */
export async function refreshShopeeToken(
  account: {
    id: string;
    shop_id: string;
    refresh_token: string;
  },
  partnerId: string,
  partnerKey: string
): Promise<string> {
  const path = SHOPEE_PATH_ACCESS_TOKEN_GET;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = signShopeeBaseString(partnerId, partnerKey, path, timestamp);

  const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;

  const body = {
    refresh_token: account.refresh_token,
    partner_id: Number(partnerId),
    shop_id: Number(account.shop_id)
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee refresh error: ${data.message || data.error}`);
  }

  const expiresAt = new Date(Date.now() + (data.expire_in - 300) * 1000);

  await prisma.shopeeAccount.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date(),
    }
  });

  return data.access_token;
}

/**
 * Alias para compatibilidade
 */
export async function refreshShopeeAccountToken(
  account: any,
  partnerId: string,
  partnerKey: string
): Promise<string> {
  return refreshShopeeToken(account, partnerId, partnerKey);
}

/**
 * Busca informações da loja
 */
export async function getShopInfo(
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: string
): Promise<any> {
  const path = SHOPEE_PATH_SHOP_INFO;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateShopeeSign(partnerId, partnerKey, path, accessToken, shopId, timestamp);

  const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Busca lista de pedidos
 */
export async function getShopeeOrderList(
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: string,
  timeFrom: number,
  timeTo: number,
  pageSize: number = 100,
  cursor?: string
): Promise<any> {
  const path = SHOPEE_PATH_ORDER_LIST;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateShopeeSign(partnerId, partnerKey, path, accessToken, shopId, timestamp);

  const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

  const body: any = {
    time_range_field: "create_time",
    time_from: timeFrom,
    time_to: timeTo,
    page_size: pageSize,
    order_status: "READY_TO_SHIP,PROCESSED,SHIPPED,COMPLETED,CANCELLED,INVOICE_PENDING"
  };

  if (cursor) {
    body.cursor = cursor;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Busca detalhes de um pedido
 */
export async function getShopeeOrderDetail(
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: string,
  orderSnList: string[]
): Promise<any> {
  const path = SHOPEE_PATH_ORDER_DETAIL;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateShopeeSign(partnerId, partnerKey, path, accessToken, shopId, timestamp);

  const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

  const body = {
    order_sn_list: orderSnList,
    response_optional_fields: "buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,item_list,pay_time,dropshipper,credit_card_number,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee_confirmed,buyer_cpf_id,fulfillment_flag,pickup_done_time,package_list,shipping_carrier,payment_method,total_amount,buyer_username,invoice_data,checkout_shipping_carrier,reverse_shipping_fee"
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API error: ${data.message || data.error}`);
  }

  return data;
}

/**
 * Busca detalhes de escrow (pagamento)
 */
export async function getShopeeEscrowDetail(
  partnerId: string,
  partnerKey: string,
  accessToken: string,
  shopId: string,
  orderSn: string
): Promise<any> {
  const path = SHOPEE_PATH_ESCROW_DETAIL;
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = generateShopeeSign(partnerId, partnerKey, path, accessToken, shopId, timestamp);

  const url = `${SHOPEE_API_BASE}${path}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

  const body = {
    order_sn: orderSn
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Shopee API error: ${data.message || data.error}`);
  }

  return data;
}
