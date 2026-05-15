#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Admin script for managing lab members.
Allows adding new members with photo upload and metadata.

Usage:
    python scripts/admin_members.py
    python scripts/admin_members.py --password "yourpassword"
"""

import argparse
import getpass
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from pathlib import Path

# =============================================================================
# Configuration
# =============================================================================
ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "members.json"
IMAGES_DIR = ROOT / "images" / "membres"
ENV_FILE = ROOT / "scripts" / ".env"

# Default password - change this or use .env file
DEFAULT_PASSWORD = "admin2024"

# Available roles for suggestions
ROLES = ["Direction", "Fellow", "Conseil scientifique", ""]


def load_password():
    """Load password from .env file or use default."""
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("ADMIN_PASSWORD="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return DEFAULT_PASSWORD


# =============================================================================
# Data operations
# =============================================================================
def load_members():
    """Load members from JSON file."""
    if not DATA_FILE.exists():
        return {"members": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_members(data):
    """Save members to JSON file with nice formatting."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  [OK] Saved to {DATA_FILE}")


def member_exists(data, member_id):
    """Check if a member ID already exists."""
    return any(m.get("id") == member_id for m in data.get("members", []))


# =============================================================================
# Utilities
# =============================================================================
def normalize_string(s):
    """Remove accents and normalize string."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    ).lower()


def generate_id(name):
    """Generate member ID from name (first letter + lastname)."""
    parts = name.strip().split()
    if len(parts) < 2:
        return normalize_string(parts[0]) if parts else "member"

    first_letter = normalize_string(parts[0][0])
    lastname = normalize_string(parts[-1])
    return first_letter + lastname


def copy_photo(source_path, member_id):
    """Copy photo to images directory."""
    source = Path(source_path).expanduser()
    if not source.exists():
        print(f"  [ERROR] Photo not found: {source}")
        return None

    # Determine extension
    ext = source.suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        print(f"  [WARNING] Unusual image format: {ext}")

    # Always save as .jpg for consistency
    dest = IMAGES_DIR / f"{member_id}.jpg"
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Try to use PIL for resizing if available
    try:
        from PIL import Image
        img = Image.open(source)
        # Resize if too large (max 600px on longest side)
        max_size = 600
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        # Convert to RGB if necessary (for PNG with transparency)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(dest, "JPEG", quality=90)
        print(f"  [OK] Photo resized and saved to {dest}")
    except ImportError:
        # PIL not available, just copy the file
        shutil.copy2(source, dest)
        print(f"  [OK] Photo copied to {dest}")
    except Exception as e:
        print(f"  [ERROR] Failed to process photo: {e}")
        # Fallback: just copy
        shutil.copy2(source, dest)
        print(f"  [OK] Photo copied (without processing) to {dest}")

    return f"/images/membres/{member_id}.jpg"


# =============================================================================
# Interactive prompts
# =============================================================================
def prompt(message, default="", required=False):
    """Prompt user for input with optional default."""
    if default:
        result = input(f"{message} [{default}]: ").strip()
        return result if result else default
    else:
        while True:
            result = input(f"{message}: ").strip()
            if result or not required:
                return result
            print("  This field is required.")


def prompt_choice(message, options, allow_custom=True):
    """Prompt user to choose from options."""
    print(f"\n{message}")
    for i, opt in enumerate(options, 1):
        label = opt if opt else "(empty)"
        print(f"  [{i}] {label}")
    if allow_custom:
        print(f"  [0] Custom value")

    while True:
        choice = input("Choose: ").strip()
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(options):
                return options[idx - 1]
            if idx == 0 and allow_custom:
                return input("Enter custom value: ").strip()
        print("  Invalid choice, try again.")


def prompt_yes_no(message, default=True):
    """Prompt for yes/no answer."""
    hint = "[Y/n]" if default else "[y/N]"
    result = input(f"{message} {hint}: ").strip().lower()
    if not result:
        return default
    return result in ("y", "yes", "o", "oui")


def prompt_member_data(existing_ids):
    """Interactively prompt for all member data."""
    print("\n" + "=" * 50)
    print("ADD NEW MEMBER")
    print("=" * 50)

    # Name (required)
    name = prompt("Full name", required=True)

    # ID (auto-generated, can be overridden)
    suggested_id = generate_id(name)
    # Ensure unique
    base_id = suggested_id
    counter = 2
    while suggested_id in existing_ids:
        suggested_id = f"{base_id}{counter}"
        counter += 1

    member_id = prompt("Member ID", default=suggested_id)
    if member_id in existing_ids:
        print(f"  [WARNING] ID '{member_id}' already exists!")
        if not prompt_yes_no("Continue anyway?", default=False):
            return None

    # Role
    role = prompt_choice("Role in the lab:", ROLES)

    # Photo
    print(f"\nPhoto (image filename in {IMAGES_DIR.name}/, or leave empty):")
    photo_name = prompt("Image filename (e.g., photo.jpg)")
    photo_url = ""
    if photo_name:
        photo_path = IMAGES_DIR / photo_name
        photo_url = copy_photo(str(photo_path), member_id)
        if not photo_url:
            if not prompt_yes_no("Continue without photo?"):
                return None
            photo_url = ""

    # Bio
    print("\nBiography (can be multiple lines, end with empty line):")
    bio_lines = []
    while True:
        line = input()
        if not line:
            break
        bio_lines.append(line)
    bio = " ".join(bio_lines)

    # Website
    url = prompt("\nPersonal website URL")

    # Social links
    print("\nSocial links (press Enter to skip):")
    social = {
        "x": prompt("  X/Twitter profile URL"),
        "linkedin": prompt("  LinkedIn profile URL"),
        "email": "",
        "facebook": prompt("  Facebook profile URL"),
        "wh": prompt("  WhatsApp link"),
        "threads": prompt("  Threads profile URL"),
    }

    # Email (special handling for mailto:)
    email = prompt("  Email address")
    if email and not email.startswith("mailto:"):
        email = f"mailto:{email}"
    social["email"] = email

    # Build member object
    member = {
        "id": member_id,
        "name": name,
        "url": url,
        "role": role,
        "photo": photo_url,
        "bio": bio,
        "social": social,
    }

    return member


def confirm_member(member):
    """Display member data and ask for confirmation."""
    print("\n" + "-" * 50)
    print("REVIEW MEMBER DATA")
    print("-" * 50)
    print(f"  ID:       {member['id']}")
    print(f"  Name:     {member['name']}")
    print(f"  Role:     {member['role'] or '(none)'}")
    print(f"  Photo:    {member['photo'] or '(none)'}")
    print(f"  Bio:      {member['bio'][:60]}..." if len(member['bio']) > 60 else f"  Bio:      {member['bio'] or '(none)'}")
    print(f"  Website:  {member['url'] or '(none)'}")
    print("  Social:")
    for key, val in member['social'].items():
        if val:
            print(f"    {key}: {val}")
    print("-" * 50)

    return prompt_yes_no("\nSave this member?")


# =============================================================================
# Main functions
# =============================================================================
def add_member():
    """Add a new member interactively."""
    data = load_members()
    existing_ids = {m.get("id") for m in data.get("members", [])}

    member = prompt_member_data(existing_ids)
    if not member:
        print("  Cancelled.")
        return

    if not confirm_member(member):
        print("  Cancelled.")
        return

    # Add to data
    data["members"].append(member)
    save_members(data)

    # Offer to regenerate pages
    if prompt_yes_no("\nRegenerate member pages now?"):
        print("  Running build_members.py...")
        try:
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "build_members.py")],
                cwd=ROOT,
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                print(result.stdout)
            else:
                print(f"  [ERROR] {result.stderr}")
        except Exception as e:
            print(f"  [ERROR] Failed to run build_members.py: {e}")


def list_members():
    """List all existing members."""
    data = load_members()
    members = data.get("members", [])

    print("\n" + "=" * 50)
    print(f"EXISTING MEMBERS ({len(members)})")
    print("=" * 50)

    for i, m in enumerate(members, 1):
        role = f" - {m['role']}" if m.get('role') else ""
        print(f"  [{i}] {m['id']}: {m['name']}{role}")

    print()
    return members


def remove_member():
    """Remove an existing member."""
    data = load_members()
    members = data.get("members", [])

    if not members:
        print("\n  No members to remove.")
        return

    print("\n" + "=" * 50)
    print("REMOVE MEMBER")
    print("=" * 50)

    # List members with numbers
    for i, m in enumerate(members, 1):
        role = f" - {m['role']}" if m.get('role') else ""
        print(f"  [{i}] {m['id']}: {m['name']}{role}")

    print(f"  [0] Cancel")
    print()

    # Get selection
    while True:
        choice = input("Select member to remove (number or ID): ").strip()

        if choice == "0":
            print("  Cancelled.")
            return

        # Try as number first
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(members):
                member = members[idx - 1]
                break
            print("  Invalid number, try again.")
            continue

        # Try as ID
        member = next((m for m in members if m.get("id") == choice), None)
        if member:
            break
        print(f"  Member ID '{choice}' not found, try again.")

    # Confirm deletion
    print(f"\n  About to remove: {member['name']} ({member['id']})")
    if not prompt_yes_no("Are you sure?", default=False):
        print("  Cancelled.")
        return

    # Remove from list
    data["members"] = [m for m in members if m.get("id") != member["id"]]
    save_members(data)

    # Offer to remove photo
    photo_path = member.get("photo", "")
    if photo_path:
        photo_file = ROOT / photo_path.lstrip("/")
        if photo_file.exists():
            if prompt_yes_no(f"Also delete photo file ({photo_file.name})?", default=True):
                try:
                    photo_file.unlink()
                    print(f"  [OK] Deleted {photo_file}")
                except Exception as e:
                    print(f"  [ERROR] Failed to delete photo: {e}")

    # Offer to remove member page
    member_page = ROOT / "membres" / f"{member['id']}.qmd"
    if member_page.exists():
        if prompt_yes_no(f"Also delete member page ({member_page.name})?", default=True):
            try:
                member_page.unlink()
                print(f"  [OK] Deleted {member_page}")
            except Exception as e:
                print(f"  [ERROR] Failed to delete page: {e}")

    print(f"\n  [OK] Member '{member['name']}' removed.")


def main_menu():
    """Display main menu and handle choices."""
    while True:
        print("\n" + "=" * 50)
        print("MEMBER ADMIN")
        print("=" * 50)
        print("  [1] Add new member")
        print("  [2] Remove member")
        print("  [3] List existing members")
        print("  [4] Exit")
        print()

        choice = input("Choose: ").strip()

        if choice == "1":
            add_member()
        elif choice == "2":
            remove_member()
        elif choice == "3":
            list_members()
        elif choice == "4":
            print("Goodbye!")
            break
        else:
            print("  Invalid choice.")


def main():
    """Entry point with password check."""
    parser = argparse.ArgumentParser(description="Admin script for managing lab members")
    parser.add_argument("--password", "-p", help="Admin password")
    args = parser.parse_args()

    # Load expected password
    expected_password = load_password()

    # Get password from argument or prompt
    if args.password:
        password = args.password
    else:
        password = getpass.getpass("Admin password: ")

    # Check password
    if password != expected_password:
        print("  [ERROR] Invalid password.")
        sys.exit(1)

    print("  [OK] Access granted.")
    main_menu()


if __name__ == "__main__":
    main()
