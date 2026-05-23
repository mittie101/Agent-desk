from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "AgentDesk_User_Guide.pdf"


def clean(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=31,
            textColor=colors.HexColor("#0B2545"),
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#394B59"),
            alignment=TA_CENTER,
            spaceAfter=18,
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=17,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=14,
            textColor=colors.HexColor("#1F2933"),
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#52606D"),
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=13.5,
            leftIndent=18,
            firstLineIndent=-10,
            textColor=colors.HexColor("#1F2933"),
            spaceAfter=4,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8.6,
            leading=11,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#F3F4F6"),
            borderColor=colors.HexColor("#D1D5DB"),
            borderWidth=0.5,
            borderPadding=5,
            spaceBefore=3,
            spaceAfter=8,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#0F5132"),
            backColor=colors.HexColor("#EAF7F0"),
            borderColor=colors.HexColor("#9BD5B5"),
            borderWidth=0.75,
            borderPadding=7,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "warn": ParagraphStyle(
            "Warning",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#7A3E00"),
            backColor=colors.HexColor("#FFF4D6"),
            borderColor=colors.HexColor("#E0B45A"),
            borderWidth=0.75,
            borderPadding=7,
            spaceBefore=4,
            spaceAfter=8,
        ),
    }


def p(text, style):
    return Paragraph(clean(text), style)


def bullet(text, styles):
    return p(f"- {text}", styles["bullet"])


def code(text, styles):
    return p(text, styles["code"])


def table(rows, widths, styles, header=True):
    converted = []
    for row in rows:
        converted.append([p(str(cell), styles["small"]) for cell in row])
    t = Table(converted, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        commands.extend(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0B2545")),
            ]
        )
    t.setStyle(TableStyle(commands))
    return t


def numbered(items, styles):
    story = []
    for index, item in enumerate(items, 1):
        story.append(p(f"{index}. {item}", styles["bullet"]))
    return story


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(inch, 0.55 * inch, "AgentDesk User Guide")
    canvas.drawRightString(7.5 * inch, 0.55 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build():
    styles = make_styles()
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.78 * inch,
        title="AgentDesk User Guide",
        author="AgentDesk",
        subject="Step-by-step user guide for AgentDesk",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="guide", frames=[frame], onPage=add_page_number)])

    story = []
    story.append(p("AgentDesk User Guide", styles["title"]))
    story.append(p("Complete operating instructions, safety rules, and five practice datasets", styles["subtitle"]))
    story.append(p("Version: Phase 9 development build | Platform: Windows 10/11 x64 | Workspace: C:\\projects\\agents", styles["small"]))
    story.append(Spacer(1, 12))
    story.append(p("What This App Does", styles["h1"]))
    story.append(p("AgentDesk is a local Windows desktop app for operating a guarded AI file-writing agent. You type a request into OrchestratorChat. The backend asks OpenAI to produce a short orchestration response, then asks the local worker agent named alice to propose a file operation. File writes do not execute immediately. They appear as a critical approval card so you can inspect, approve, or deny the action.", styles["body"]))
    story.append(p("In the current Phase 9 build, AgentDesk is best used as a controlled practice environment for learning how an AI agent proposes file changes, how approvals work, how snapshots protect the workspace, and how runtime events/errors expose what happened.", styles["body"]))
    story.append(p("Important: AgentDesk is not yet packaged for end-user installation. It runs from the project folder with npm start. Packaging/distribution is marked for later Phase 10 work.", styles["warn"]))
    story.append(p("Quick Mental Model", styles["h2"]))
    story.append(table([
        ["Area", "Purpose"],
        ["OrchestratorChat", "Enter a natural-language instruction for the agent."],
        ["Agent alice", "The single local worker agent that proposes file writes."],
        ["Approval Card", "Shows pending critical action. Approve or deny here."],
        ["Typed Confirmation Card", "Requires the exact phrase for critical approvals and snapshot restores."],
        ["EventStream", "Live log of info, warning, and error events."],
        ["Snapshot Manager", "Create, preview, and restore workspace snapshots."],
        ["Cost Counter", "Shows token usage reported by OpenAI calls."],
        ["Errors", "Persistent visible runtime failures."],
    ], [1.55 * inch, 5.0 * inch], styles))

    story.append(PageBreak())
    story.append(p("1. First-Time Setup", styles["h1"]))
    story.append(p("Use these steps when starting from the project folder. All commands are PowerShell commands.", styles["body"]))
    story += numbered([
        "Open PowerShell.",
        "Go to the project folder: cd C:\\projects\\agents",
        "Install dependencies if this is a fresh checkout: npm install",
        "Create or edit the .env file in C:\\projects\\agents.",
        "Put your OpenAI key in .env as OPENAI_API_KEY=your-key-here.",
        "Optionally set AGENTDESK_OPENAI_MODEL=gpt-5.4 or another supported model.",
        "Start the app with npm start.",
    ], styles)
    story.append(code("cd C:\\projects\\agents\nnpm install\nnotepad .env\nnpm start", styles))
    story.append(p("The .env file should look like this. Do not include quotes unless your local tooling requires them.", styles["body"]))
    story.append(code("OPENAI_API_KEY=your-openai-api-key-here\nAGENTDESK_OPENAI_MODEL=gpt-5.4", styles))
    story.append(p("Security rule: never paste real keys into chat, screenshots, issue trackers, or documentation. AgentDesk reads the key in the backend process. The renderer UI only receives openaiConfigured true/false from /health, not the key itself.", styles["warn"]))
    story.append(p("How to Know Setup Worked", styles["h2"]))
    story += [bullet(x, styles) for x in [
        "The desktop window opens and shows AgentDesk.",
        "A green toast appears: OpenAI key loaded. AgentDesk is ready for live model calls.",
        "The header status changes from loading to Backend state loaded.",
        "The agent list shows alice.",
        "The EventStream shows database or startup events.",
    ]]
    story.append(p("If you do not see the green toast, check that .env exists in C:\\projects\\agents, that OPENAI_API_KEY has a non-empty value, and that the app was restarted after editing .env.", styles["body"]))

    story.append(p("2. Safe Operating Rules", styles["h1"]))
    story.append(p("AgentDesk can write files in the alice workspace after you approve a proposed action. Treat the approval step seriously.", styles["body"]))
    story += [bullet(x, styles) for x in [
        "Read the Approval Card before approving.",
        "Only approve file paths that belong in the workspace.",
        "Keep Require typed confirmation enabled while learning.",
        "Create a snapshot before experimenting.",
        "Use Preview restore before restoring a snapshot.",
        "Never ask the agent to write .env files or secrets. Protected .env writes are blocked in this build.",
        "Do not use the app against important folders until packaging and hardened workspace selection are finished.",
    ]]
    story.append(p("Critical confirmation phrase:", styles["h2"]))
    story.append(code("I understand this critical action", styles))
    story.append(p("You must type that phrase exactly before approving a critical write or restoring a snapshot. The phrase is case-sensitive.", styles["body"]))

    story.append(p("3. Understanding the Screen", styles["h1"]))
    story.append(p("The screen is split into three columns. The left column is agent and snapshot control, the center column is event history, and the right column is chat, settings, approvals, confirmation, and errors.", styles["body"]))
    story.append(p("Left Column", styles["h2"]))
    story += [bullet(x, styles) for x in [
        "Agents: shows alice, her status, model, permissions, and pending queue count.",
        "Interrupt alice: marks the agent interrupted if you need to stop the current run state.",
        "Snapshot Manager: captures and restores the workspace folder.",
        "Cost Counter: tracks input tokens, output tokens, total tokens, and estimated cost.",
    ]]
    story.append(p("Center Column", styles["h2"]))
    story += [bullet(x, styles) for x in [
        "EventStream: chronological log of backend activity.",
        "Level filter: show all, info, warn, error, or debug.",
        "Search events: search event message and source text.",
        "Raw payload: expand this when debugging exact backend details.",
    ]]
    story.append(p("Right Column", styles["h2"]))
    story += [bullet(x, styles) for x in [
        "OrchestratorChat: send instructions to the agent.",
        "Settings: model, max budget, and typed-confirmation setting.",
        "Approval Card: approve or deny the current pending action.",
        "Typed Confirmation Card: enter the exact critical phrase.",
        "Errors: shows runtime errors that need attention.",
    ]]

    story.append(p("4. Your First Successful Run", styles["h1"]))
    story.append(p("This walkthrough creates a harmless practice file. It is the fastest way to understand the app.", styles["body"]))
    story += numbered([
        "Start the app with npm start.",
        "Confirm the green OpenAI toast is visible.",
        "In Snapshot Manager, name the snapshot Before first practice.",
        "Click Create snapshot.",
        "In OrchestratorChat, paste the prompt below.",
        "Click Send chat.",
        "Wait for the Approval Card to show a pending write_file action.",
        "Inspect the path. It should be a simple workspace-relative file such as hello-agentdesk.txt.",
        "In the Typed Confirmation Card, type: I understand this critical action",
        "Click Approve.",
        "Check EventStream for Approved write_file executed and Agent run completed.",
        "Open C:\\projects\\agents\\workspaces\\alice and confirm the file exists.",
    ], styles)
    story.append(code("Create a file named hello-agentdesk.txt with this exact content:\nHello from AgentDesk.\nThis is my first approved AI file write.", styles))
    story.append(p("If the Approval Card does not appear, check the Errors panel. Missing or invalid OpenAI keys appear as OPENAI_KEY_MISSING or OPENAI_INVALID_KEY.", styles["body"]))

    story.append(p("5. Daily Workflow", styles["h1"]))
    story.append(p("Use this sequence for normal work.", styles["body"]))
    story += numbered([
        "Start from a clean app launch.",
        "Create a snapshot before trying a new task.",
        "Send one clear instruction at a time.",
        "Wait for alice to move through running into waiting_for_approval.",
        "Review the proposed action in the Approval Card.",
        "Approve only if the path and action make sense.",
        "Deny if the request is wrong, too broad, unexpected, or unsafe.",
        "Use EventStream and Errors to understand failures.",
        "Create another snapshot after a good result.",
    ], styles)
    story.append(p("Prompting Tips", styles["h2"]))
    story += [bullet(x, styles) for x in [
        "Ask for one file at a time in this build.",
        "Give an exact file name.",
        "Give exact content or a clearly bounded structure.",
        "Avoid vague instructions like improve my project unless you are prepared to inspect the proposed write carefully.",
        "Use simple relative paths such as notes.md or samples/inventory.json.",
    ]]
    story.append(p("Good prompt shape:", styles["body"]))
    story.append(code("Create a file named samples/team-notes.md. Include a title, three bullets, and a next-actions section.", styles))

    story.append(p("6. Settings", styles["h1"]))
    story.append(table([
        ["Setting", "What it controls", "Recommended value"],
        ["Runtime safety / model", "Model name used by the backend OpenAI service.", "gpt-5.4 unless you deliberately change it."],
        ["Max budget", "Runtime budget guard value saved in app settings.", "2 for practice; lower if you want stricter limits."],
        ["Require typed confirmation", "Whether critical actions require the exact confirmation phrase.", "Enabled."],
    ], [1.45 * inch, 3.1 * inch, 2.0 * inch], styles))
    story.append(p("To open settings quickly, press Ctrl+, then adjust fields and click Save settings. If you disable typed confirmation, AgentDesk shows a warning banner. Keep it enabled unless you are deliberately testing unrestricted mode.", styles["body"]))

    story.append(p("7. Approvals and Denials", styles["h1"]))
    story.append(p("Approvals are the main safety boundary. The agent may propose a write, but the backend waits for your decision.", styles["body"]))
    story.append(table([
        ["Choice", "Use when", "Result"],
        ["Approve", "The file path and content match your intent.", "The backend writes the file, creates backups when overwriting, and logs completion."],
        ["Deny", "The action is wrong, unclear, too broad, or unsafe.", "The run is marked denied and alice returns to idle."],
        ["Interrupt alice", "The agent is stuck or you want to stop the current state.", "alice is marked interrupted."],
    ], [1.15 * inch, 3.2 * inch, 2.2 * inch], styles))

    story.append(p("8. Snapshots", styles["h1"]))
    story.append(p("Snapshots capture the alice workspace so you can roll back practice changes. They are stored under the workspace in .agentdesk-snapshots and tracked in the local database.", styles["body"]))
    story.append(p("Create a Snapshot", styles["h2"]))
    story += numbered([
        "Enter a clear snapshot name, such as Before inventory practice.",
        "Click Create snapshot.",
        "Confirm the snapshot appears in the dropdown.",
    ], styles)
    story.append(p("Preview a Restore", styles["h2"]))
    story += numbered([
        "Select a snapshot.",
        "Click Preview restore.",
        "Read the restore diff count. This tells you how many files would change.",
    ], styles)
    story.append(p("Restore a Snapshot", styles["h2"]))
    story += numbered([
        "Select the snapshot.",
        "Type the exact critical confirmation phrase.",
        "Click Restore with confirmation.",
        "Check EventStream for Snapshot restored.",
    ], styles)
    story.append(p("Snapshot restore validates manifest paths and file hashes before copying content back. If snapshot content is corrupt or tries to escape the workspace, the restore fails instead of silently continuing.", styles["callout"]))

    story.append(p("9. EventStream and Errors", styles["h1"]))
    story.append(p("The EventStream is your black box recorder. When something feels confusing, read events from oldest to newest and expand Raw payload for details.", styles["body"]))
    story.append(table([
        ["Event level", "Meaning", "Typical action"],
        ["info", "Normal operation completed or progressed.", "Use as confirmation."],
        ["warn", "A guarded, unusual, or operator-facing condition happened.", "Inspect before continuing."],
        ["error", "A runtime operation failed.", "Check Errors panel and fix cause."],
        ["debug", "Low-level diagnostic detail if present.", "Use for troubleshooting."],
    ], [1.1 * inch, 2.6 * inch, 2.85 * inch], styles))
    story.append(p("Common Error Codes", styles["h2"]))
    story.append(table([
        ["Code", "Meaning", "Fix"],
        ["OPENAI_KEY_MISSING", "No backend API key was available.", "Edit .env and restart npm start."],
        ["OPENAI_INVALID_KEY", "OpenAI rejected the key.", "Rotate/fix the key and restart."],
        ["CONFIRMATION_MISMATCH", "Typed confirmation did not match exactly.", "Re-type the exact phrase."],
        ["SNAPSHOT_CONFIRMATION_REQUIRED", "Snapshot restore needs confirmation.", "Type the exact phrase before restore."],
        ["PROTECTED_ENV_WRITE", "The agent tried to write .env.", "Deny the task; do not store secrets through the agent."],
        ["WORKER_PLAN_INVALID", "The worker did not return valid JSON.", "Try a clearer, simpler prompt."],
    ], [1.7 * inch, 2.55 * inch, 2.3 * inch], styles))

    story.append(p("10. Practice Dataset 1: Personal Budget CSV", styles["h1"]))
    story.append(p("Goal: learn a clean approve flow and create a small CSV file.", styles["body"]))
    story.append(code("Create a file named samples/budget-may.csv with this exact CSV content:\ncategory,planned,actual,notes\nRent,1200,1200,Fixed housing cost\nGroceries,350,382,Two extra bulk shops\nTransport,120,96,Worked from home twice\nUtilities,180,174,Normal month\nSavings,500,500,Automatic transfer", styles))
    story.append(p("Practice steps: create a snapshot, send the prompt, approve the write, then open workspaces\\alice\\samples\\budget-may.csv. Use EventStream search for virtual-fs to find the write event.", styles["body"]))

    story.append(p("11. Practice Dataset 2: Meeting Notes Markdown", styles["h1"]))
    story.append(p("Goal: practice approving a markdown document and checking content formatting.", styles["body"]))
    story.append(code("Create a file named samples/project-kickoff-notes.md with these sections:\n# Project Kickoff Notes\n\n## Attendees\n- Alex\n- Priya\n- Morgan\n\n## Decisions\n- Build a small desktop prototype first.\n- Keep file writes behind approvals.\n- Store practice outputs in the samples folder.\n\n## Next Actions\n- Alex: prepare sample data.\n- Priya: test the approval flow.\n- Morgan: review the snapshot restore workflow.", styles))
    story.append(p("Practice steps: approve the file, then create a snapshot named After meeting notes. This gives you a restore point after a known-good output.", styles["body"]))

    story.append(p("12. Practice Dataset 3: Inventory JSON", styles["h1"]))
    story.append(p("Goal: practice structured data and learn what a worker JSON output can write.", styles["body"]))
    story.append(code("Create a file named samples/inventory.json with this exact JSON:\n{\n  \"location\": \"Workshop A\",\n  \"items\": [\n    { \"sku\": \"CAB-001\", \"name\": \"USB-C cable\", \"quantity\": 18, \"reorderAt\": 5 },\n    { \"sku\": \"DRV-014\", \"name\": \"Precision screwdriver\", \"quantity\": 7, \"reorderAt\": 3 },\n    { \"sku\": \"BOX-220\", \"name\": \"Storage box\", \"quantity\": 11, \"reorderAt\": 4 }\n  ]\n}", styles))
    story.append(p("Practice steps: after approval, open Raw payload on the subagent-worker event. Confirm the proposed path matches samples/inventory.json.", styles["body"]))

    story.append(PageBreak())
    story.append(p("13. Practice Dataset 4: Bug Triage Checklist", styles["h1"]))
    story.append(p("Goal: practice a workflow file that you can reuse when testing the app.", styles["body"]))
    story.append(code("Create a file named samples/bug-triage-checklist.md with this exact content:\n# Bug Triage Checklist\n\n- [ ] Reproduce the issue from a fresh app start.\n- [ ] Check the Errors panel.\n- [ ] Search EventStream by error source.\n- [ ] Confirm whether OpenAI is configured.\n- [ ] Create a snapshot before retrying risky actions.\n- [ ] Record the exact prompt that triggered the issue.\n- [ ] Deny any unexpected file write request.", styles))
    story.append(p("Practice steps: deliberately type the wrong confirmation phrase once and observe CONFIRMATION_MISMATCH. Then type the exact phrase and approve.", styles["body"]))

    story.append(p("14. Practice Dataset 5: Restore Drill", styles["h1"]))
    story.append(p("Goal: learn snapshot preview and restore without touching important files.", styles["body"]))
    story.append(code("Create a file named samples/restore-drill.txt with this exact content:\nRestore drill version 1\nThis file exists so I can practice snapshots safely.", styles))
    story += numbered([
        "Create a snapshot named Restore drill v1.",
        "Send another prompt asking the agent to overwrite samples/restore-drill.txt with version 2 text.",
        "Approve the overwrite only if the path is exactly samples/restore-drill.txt.",
        "Preview restore for Restore drill v1.",
        "Type the exact critical phrase and restore.",
        "Open the file and confirm it is back to version 1.",
    ], styles)
    story.append(code("Overwrite samples/restore-drill.txt with this exact content:\nRestore drill version 2\nThis changed version should disappear after I restore the snapshot.", styles))

    story.append(p("15. Troubleshooting", styles["h1"]))
    story.append(table([
        ["Problem", "Likely cause", "What to do"],
        ["App says OpenAI not detected", ".env missing, empty, or app not restarted.", "Edit .env, save it, close app, run npm start again."],
        ["Approval button fails", "Typed confirmation mismatch.", "Use exact phrase: I understand this critical action."],
        ["No approval appears", "OpenAI request failed or worker returned invalid JSON.", "Check Errors and EventStream; simplify prompt."],
        ["Snapshot restore fails", "Missing confirmation, invalid snapshot, or hash/path validation failure.", "Preview first; use exact phrase; choose a valid snapshot."],
        ["npm start fails", "Port conflict, dependency issue, or backend startup failure.", "Close old AgentDesk processes; check npm-start logs."],
        ["File not where expected", "Workspace-relative path may differ.", "Check C:\\projects\\agents\\workspaces\\alice."],
    ], [1.7 * inch, 2.2 * inch, 2.65 * inch], styles))

    story.append(p("16. Current Limits and Best Use", styles["h1"]))
    story += [bullet(x, styles) for x in [
        "This is a Phase 9 development build, not an installer-ready product.",
        "There is one built-in worker agent: alice.",
        "The worker currently supports proposed write_file actions.",
        "The backend binds to 127.0.0.1:9403.",
        "The renderer cannot access Node APIs and does not receive API keys.",
        "Packaged backend startup is not finished until Phase 10.",
        "Use it for controlled local file-writing practice, approval flow training, snapshot drills, and UI validation.",
    ]]
    story.append(p("Best practice: keep all practice prompts aimed at the samples folder until you are comfortable reading approvals, events, and restore previews.", styles["callout"]))

    story.append(p("17. Full-Potential Learning Path", styles["h1"]))
    story += numbered([
        "Run Dataset 1 to learn the basic approve flow.",
        "Run Dataset 2 to learn markdown outputs and post-success snapshots.",
        "Run Dataset 3 to inspect structured JSON output and raw event payloads.",
        "Run Dataset 4 to learn confirmation failure and recovery.",
        "Run Dataset 5 to learn safe overwrite and restore.",
        "After each run, search EventStream by source: orchestrator, subagent-worker, virtual-fs, snapshot-manager, and openai-service.",
        "After every risky experiment, create or restore a snapshot so you understand the workspace safety loop.",
    ], styles)

    story.append(p("Appendix: Command Reference", styles["h1"]))
    story.append(code("cd C:\\projects\\agents\nnpm install\nnpm start\nnpm test\nnpm run phase9:check", styles))
    story.append(p("Health check while app is running:", styles["body"]))
    story.append(code("Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9403/health", styles))
    story.append(p("Expected safe health shape:", styles["body"]))
    story.append(code("{\"ok\":true,\"service\":\"agentdesk-backend\",\"phase\":9,\"openaiConfigured\":true}", styles))
    story.append(p("Notice that the health response reports only whether a key is configured. It must never print the key.", styles["warn"]))

    doc.build(story)


if __name__ == "__main__":
    build()
