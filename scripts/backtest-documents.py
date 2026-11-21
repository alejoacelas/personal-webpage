#!/usr/bin/env python3
"""Review owned Google Docs without changing Drive or publishing anything.

Run with Python 3.9+ and gog signed into the personal account. The JSON report
goes in a new private directory under the current user's cache. Use --since
YYYY-MM-DD to change the default 45-day window. For a new candidate, inspect
all Docs tabs, links, media, suggestions and Drive comment threads before adding
its fingerprint to the reviewed documents file.

For a document involving someone else, pass a private --exceptions JSON object.
Key entries by document ID with values {"fingerprint": "...", "reason": "..."}.
Only add an exception after Alejo approves that particular version for the site.
Exceptions still require public read/comment access and personal ownership.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile
from collections import Counter

ACCOUNT = "alejoacelas@gmail.com"
REVIEWED = pathlib.Path(__file__).with_name("reviewed-documents.json")


def gog(*args):
    result = subprocess.run(
        ["gog", "--account", ACCOUNT, "--readonly", "--no-input", "-j", *args],
        capture_output=True, text=True, check=True, timeout=120,
    )
    return json.loads(result.stdout)


def files_since(since):
    query = (
        "'me' in owners and trashed = false and "
        "mimeType = 'application/vnd.google-apps.document' and "
        f"modifiedTime >= '{since.isoformat()}T00:00:00Z'"
    )
    args = ["drive", "ls", "--all", "--no-all-drives", "--max", "100", "--query", query,
            "--fields", "nextPageToken,files(id,name,owners(emailAddress),permissions(type,role),modifiedTime)"]
    page_args = []
    while True:
        response = gog(*args, *page_args)
        yield from response.get("files") or []
        token = response.get("nextPageToken")
        if not token:
            return
        page_args = ["--page", token]


def fingerprint(doc, comments, modified):
    # Google rotates revision IDs and signed image URLs even with no source edit.
    # modifiedTime still invalidates a decision when embedded content is edited.
    def stable(node):
        if isinstance(node, list):
            return [stable(item) for item in node]
        if isinstance(node, dict):
            return {key: stable(value) for key, value in node.items()
                    if key not in {"revisionId", "contentUri", "thumbnailUri", "photoLink"}}
        return node
    data = json.dumps(stable([doc, comments, modified]), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data.encode()).hexdigest()


def inspect_mentions(doc, comments):
    def objects(node):
        if isinstance(node, dict):
            yield node
            for value in node.values():
                yield from objects(value)
        elif isinstance(node, list):
            for value in node:
                yield from objects(value)

    for node in objects(comments):
        if "author" in node and node["author"].get("me") is not True:
            return "Comment or reply from another person"
    for node in objects(doc):
        if "personProperties" in node:
            person = node["personProperties"]
            if person.get("email") != ACCOUNT:
                return "Person chip requires review"
        content = node.get("textRun", {}).get("content", "")
        emails = re.findall(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", content)
        if any(address.lower() != ACCOUNT for address in emails):
            return "Contains another email address"
    return "Review all tabs, comments and embedded material for mentions and others’ information"


def classify(file, reviewed, exceptions):
    file_id = file["id"]
    if [owner.get("emailAddress") for owner in file.get("owners", [])] != [ACCOUNT]:
        return {"reason": "Ownership could not be verified"}
    roles = {p.get("role") for p in file.get("permissions", []) if p.get("type") == "anyone"}
    if not roles or not roles.issubset({"reader", "commenter"}):
        return {"reason": "No qualifying anyone-with-link reader or commenter permission"}
    doc = gog("docs", "raw", file_id, "--all-tabs")
    comments = gog("drive", "comments", "list", file_id, "--all", "--include-quoted")
    if not doc.get("tabs") or "comments" not in comments or comments.get("nextPageToken"):
        return {"reason": "Could not verify every tab and comment"}
    digest = fingerprint(doc, comments, file["modifiedTime"])
    if reviewed.get(file_id) == digest:
        return {"fingerprint": digest, "eligible": True, "reason": "Reviewed draft or template"}
    exception = exceptions.get(file_id, {})
    if exception.get("fingerprint") == digest and exception.get("reason", "").strip():
        return {"fingerprint": digest, "eligible": True, "reason": exception["reason"]}
    if file_id in reviewed or file_id in exceptions:
        reason = "Changed since review"
    else:
        reason = inspect_mentions(doc, comments)
    return {"fingerprint": digest, "reason": reason}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--since", type=dt.date.fromisoformat,
                        default=dt.date.today() - dt.timedelta(days=45))
    parser.add_argument("--exceptions", type=pathlib.Path)
    args = parser.parse_args()
    reviewed = json.loads(REVIEWED.read_text())
    exceptions = json.loads(args.exceptions.read_text()) if args.exceptions else {}
    cache = pathlib.Path.home() / ".cache" / "website-document-backtests"
    cache.mkdir(mode=0o700, parents=True, exist_ok=True)
    report = []
    errors = 0
    for file in files_since(args.since):
        try:
            result = classify(file, reviewed, exceptions)
        except (subprocess.SubprocessError, ValueError, KeyError) as error:
            result = {"reason": "Could not inspect source", "error": type(error).__name__}
            errors += 1
        report.append({"id": file["id"], "title": file["name"], "modified": file["modifiedTime"],
                       "eligible": False, **result})
    destination = pathlib.Path(tempfile.mkdtemp(dir=cache)) / "report.json"
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(destination)
    print(dict(Counter("eligible" if item["eligible"] else "held" for item in report)))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
