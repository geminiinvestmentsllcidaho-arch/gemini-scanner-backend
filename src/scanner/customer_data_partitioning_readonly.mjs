import path from "node:path";

export const VERSION = "customer_data_partitioning_readonly_v1";
export const POLICY = "customer_tenant_account_path_partition_v1";
export const DEFAULT_CUSTOMER_TENANT_ID = "gemini-scanner-customers";
export const DEFAULT_CUSTOMER_DATA_ROOT = path.resolve("runs/customers");

function clean(value) {
  return String(value ?? "").trim();
}

function safeSegment(value, label) {
  const segment = clean(value);
  if (!segment) throw new Error(`${label}_required`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(segment)) {
    throw new Error(`${label}_invalid`);
  }
  if (segment === "." || segment === "..") {
    throw new Error(`${label}_invalid`);
  }
  return segment;
}

function assertContained(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  if (
    relative === ""
    || relative.startsWith(`..${path.sep}`)
    || relative === ".."
    || path.isAbsolute(relative)
  ) {
    throw new Error("customer_partition_path_escape");
  }
}

export function buildCustomerDataPartitionContext(input = {}, options = {}) {
  const rootPath = path.resolve(clean(options.rootPath) || DEFAULT_CUSTOMER_DATA_ROOT);
  const tenantId = safeSegment(
    input.tenantId || options.tenantId || DEFAULT_CUSTOMER_TENANT_ID,
    "tenant_id",
  );
  const accountId = safeSegment(input.accountId, "account_id");

  const tenantPath = path.resolve(rootPath, tenantId);
  const accountPath = path.resolve(tenantPath, accountId);
  assertContained(rootPath, tenantPath);
  assertContained(tenantPath, accountPath);

  return Object.freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    tenantId,
    accountId,
    rootPath,
    tenantPath,
    accountPath,
    partitioned: true,
    readOnlyFoundation: true,
    migrationPerformed: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
  });
}

export function buildCustomerPartitionedStorePath(
  input = {},
  storeName,
  options = {},
) {
  const context = buildCustomerDataPartitionContext(input, options);
  const safeStoreName = safeSegment(storeName, "store_name");
  const extension = clean(options.extension) || ".jsonl";

  if (!/^\.[A-Za-z0-9]{1,12}$/.test(extension)) {
    throw new Error("store_extension_invalid");
  }

  const storePath = path.resolve(
    context.accountPath,
    `${safeStoreName}${extension}`,
  );
  assertContained(context.accountPath, storePath);

  return Object.freeze({
    ...context,
    storeName: safeStoreName,
    storePath,
    storePathLabel: path.join(
      path.basename(context.tenantPath),
      path.basename(context.accountPath),
      path.basename(storePath),
    ),
  });
}

export function buildCustomerDataPartitioningStatus(options = {}) {
  const rootPath = path.resolve(clean(options.rootPath) || DEFAULT_CUSTOMER_DATA_ROOT);
  return Object.freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    defaultTenantId: DEFAULT_CUSTOMER_TENANT_ID,
    rootPathLabel: path.basename(rootPath),
    pathPartitioningImplemented: true,
    existingStoresMigrated: false,
    runtimeStoreCutoverEnabled: false,
    readOnlyFoundation: true,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
  });
}

export default {
  VERSION,
  POLICY,
  DEFAULT_CUSTOMER_TENANT_ID,
  DEFAULT_CUSTOMER_DATA_ROOT,
  buildCustomerDataPartitionContext,
  buildCustomerPartitionedStorePath,
  buildCustomerDataPartitioningStatus,
};
