export type RelationshipStatus = 'friend' | 'pending_sent' | 'pending_received' | 'none';
export interface UserSearchResult {
  id: string;
  username: string;
  relationshipStatus: RelationshipStatus;
  friendRequestId?: string;
}
//# sourceMappingURL=users.d.ts.map
