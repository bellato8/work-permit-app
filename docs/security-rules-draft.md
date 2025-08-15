# Security Rules Draft

- Storage and Firestore rules are configured in Firebase console for production.
- During development, allow authenticated access only.
- Validate file paths under `contractor-requests/{requestId}` and enforce ownership.
- Ensure request documents are readable by admins and owners, writable only on creation.
- Use Firebase Authentication to restrict admin dashboard.
