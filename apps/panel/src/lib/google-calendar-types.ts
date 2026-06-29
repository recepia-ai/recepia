// ---------------------------------------------------------------------------
// Google Calendar API types
// ---------------------------------------------------------------------------
// TypeScript types for Google Calendar REST API v3 responses.
// Source: https://developers.google.com/calendar/api/v3/reference
// ---------------------------------------------------------------------------

/** Entry in the calendarList response (endpoint /users/me/calendarList). */
export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  backgroundColor?: string;
  foregroundColor?: string;
  timeZone?: string;
};

/** Response from GET /calendar/v3/users/me/calendarList. */
export type GoogleCalendarListResponse = {
  kind: string;
  etag: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarListItem[];
};

/** Response from POST /oauth2/v2/userinfo. */
export type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
};

/** Token refresh response from POST /oauth2.googleapis.com/token. */
export type GoogleTokenRefreshResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};
