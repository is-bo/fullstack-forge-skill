# Build brief: Object and file storage

## Decide before coding

- Decide objects are private-by-default with authorization checked before any signed URL is issued, rather than relying on an unguessable name for protection.
- Decide the object naming and tenant-prefix scheme before the first object is written, so isolation does not depend on remembering to filter later.
- Decide the scope, method, and expiry bound on any signed URL this feature issues, treating it as a scoped credential rather than a permanent link.
- Decide the lifecycle for this object: when it is deleted, replaced, or expires, and what cleans up the object when the owning record is deleted.
- Decide the content-type and content-disposition headers served with this object so it cannot be rendered or executed in a way that harms the viewer.

## Evidence to produce while building

- A test showing an unauthorized or cross-tenant request for an object is denied, not just unlisted.
- Confirmation that issued signed URLs are scoped to one object, one method, and a bounded expiry.
- A test or trace showing object deletion actually removes the object (or schedules it), leaving no orphan.
- Confirmation of the served content-type and content-disposition for this object type.
