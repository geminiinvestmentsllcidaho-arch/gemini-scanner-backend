import { writePaperAttemptModuleCompleteSelectorPanelReport } from "../src/scanner/paper_attempt_module_complete_selector_panel.mjs";

const result = writePaperAttemptModuleCompleteSelectorPanelReport();
console.log(JSON.stringify(result.panel, null, 2));
console.log(`wrote ${result.out}`);
