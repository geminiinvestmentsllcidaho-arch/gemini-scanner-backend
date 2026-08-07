import fs from "node:fs";
import path from "node:path";

const CUSTOMER_FILE_PATTERN = /(customer|public_homepage)/i;
const EXTENSIONS = new Set([".js", ".mjs", ".html"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function visibleFragments(source) {
  const fragments = [];
  const patterns = [
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    /<label[^>]*>([\s\S]*?)<\/label>/gi,
    /<button[^>]*>([\s\S]*?)<\/button>/gi,
    /<summary[^>]*>([\s\S]*?)<\/summary>/gi,
    /<option[^>]*>([\s\S]*?)<\/option>/gi,
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = String(match[1] ?? "")
        .replace(/\$\{[\s\S]*?\}/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
      if (value) fragments.push(value);
    }
  }
  return fragments;
}

function addIssue(issues, type, file, text, detail) {
  issues.push({ type, file, text: text.slice(0, 220), detail });
}

export function auditCustomerPresentation({ rootDir = "src" } = {}) {
  const files = walk(rootDir).filter((file) => CUSTOMER_FILE_PATTERN.test(file));
  const issues = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const fragment of visibleFragments(source)) {
      if (/\b(?:en-US|en-CA|en-GB|America\/New_York|America\/Chicago|America\/Denver|America\/Los_Angeles)\b/.test(fragment)) {
        addIssue(issues, "raw_locale_or_timezone", file, fragment, "Use a friendly customer label instead of a raw locale or time-zone token.");
      }
      if (/(?:^|\b)(?:Theme|Layout)\s*:\s*(?:dark|light|system|compact|comfortable)\b/.test(fragment)) {
        addIssue(issues, "raw_display_preference", file, fragment, "Capitalize or translate display preference values before rendering.");
      }
      if (/\b[a-z]+_[a-z0-9_]+\b/.test(fragment)) {
        addIssue(issues, "raw_snake_case", file, fragment, "Translate internal snake_case tokens before rendering them to customers.");
      }
      if (/\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/.test(fragment)) {
        addIssue(issues, "raw_camel_case", file, fragment, "Translate internal camelCase tokens before rendering them to customers.");
      }
      if (/[A-Za-z0-9][—–][A-Za-z0-9]/.test(fragment)) {
        addIssue(issues, "tight_dash", file, fragment, "Use spaces around a prose dash.");
      }
      if (/\s+[,;:!?]/.test(fragment)) {
        addIssue(issues, "space_before_punctuation", file, fragment, "Remove the extra space before punctuation.");
      }
      if (/[,;:!?][A-Za-z]/.test(fragment)) {
        addIssue(issues, "missing_space_after_punctuation", file, fragment, "Add a space after punctuation.");
      }
      if (/\b(read-only)\.\s+\1\b/i.test(fragment)) {
        addIssue(issues, "duplicate_phrase", file, fragment, "Remove repeated customer-facing wording.");
      }
    }
  }

  const unique = [...new Map(issues.map((item) => [`${item.type}|${item.file}|${item.text}`, item])).values()];
  return {
    version: "customer_presentation_qa_v1",
    readOnly: true,
    checkedFileCount: files.length,
    issueCount: unique.length,
    issues: unique,
  };
}
