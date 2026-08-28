import { contentTypeEnum, type ContentType, type OrganizationType } from "@/db/schema";

/**
 * Which content types a workspace of each organization type may use.
 * "general" (the default for every workspace unless explicitly changed) is
 * unrestricted. Single source of truth — imported by both the client
 * (to filter the Content type dropdown) and the API routes (to actually
 * enforce it), so the two can never drift apart.
 */
export const ALLOWED_CONTENT_TYPES: Record<OrganizationType, readonly ContentType[]> = {
  general: contentTypeEnum,
  corporate: ["meeting"],
  church: ["sermon"],
  podcast: ["podcast"],
};

export function isContentTypeAllowed(
  organizationType: OrganizationType,
  contentType: ContentType
): boolean {
  return ALLOWED_CONTENT_TYPES[organizationType].includes(contentType);
}
