# Contributing to AuthentiFi (Educational & Academic Project)

First off, thank you for considering contributing to this repository! 

This repository is maintained and developed as part of an **academic curriculum and educational coursework** in Blockchain Technology. We welcome contributions from project team members, peers, and collaborators aimed at improving, extending, or maintaining this codebase for study and research.

Following these guidelines helps keep the development process organized, transparent, and aligned with academic integrity standards.

---

## Table of Contents

1. [Academic Disclaimer & Purpose](#1-academic-disclaimer--purpose)
2. [Attribution & Original Authors](#2-attribution--original-authors)
3. [Academic Integrity Policy](#3-academic-integrity-policy)
4. [Code of Conduct](#4-code-of-conduct)
5. [Getting Started](#5-getting-started)
6. [Branching & Development Workflow](#6-branching--development-workflow)
7. [Commit Message Conventions](#7-commit-message-conventions)
8. [Coding Standards & Best Practices](#8-coding-standards--best-practices)
9. [Submitting a Pull Request](#9-submitting-a-pull-request)
10. [Licensing](#10-licensing)

---

## 1. Academic Disclaimer & Purpose

- **Educational Context:** This repository is intended strictly for **educational, academic, and non-commercial research purposes** within a university blockchain coursework setting.
- **No Commercial Use:** None of the materials, source code, or documentation in this repository may be commercialized or deployed for profit.
- **Fair Use:** This project serves as a proof-of-concept (PoC) study exploring decentralized product ownership verification, smart contract security, and anti-counterfeiting workflows.

---

## 2. Attribution & Original Authors

This project builds upon and references the open-source **[AuthentiFi](https://github.com/kylelobo/AuthentiFi)** project. Full credit and gratitude are extended to the original creators:

- **[Kyle Lobo](https://github.com/kylelobo)**
- **[Calden Rodrigues](https://github.com/caldenrodrigues)**
- **[JohnAnand Abraham](https://github.com/johnanand)**
- **[Pratik Nerurkar](https://github.com/PlayPratz)**

Original Project Repository: [https://github.com/kylelobo/AuthentiFi](https://github.com/kylelobo/AuthentiFi)

---

## 3. Academic Integrity Policy

To maintain compliance with academic integrity and anti-plagiarism standards:

- **Attribution of External Code:** Any third-party libraries, algorithms, contract standards (e.g., OpenZeppelin), or snippets must be explicitly cited in the comments with references to their original source.
- **Demarcation of New Work:** Project contributors must clearly document and delineate student-developed features, refactored logic, and extensions versus inherited codebase modules in project reports and PR descriptions.
- **No Contract Impersonation:** Do not submit or present inherited modules as self-authored deliverables.

---

## 4. Code of Conduct

All contributors and team members are expected to:

- Treat teammates and reviewers with respect, empathy, and constructive feedback.
- Focus on collaborative problem-solving and knowledge sharing.
- Respect diverse viewpoints and maintain professional communication during discussions and code reviews.

---

## 5. Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [MySQL](https://dev.mysql.com/) Server
- [Ganache](https://trufflesuite.com/ganache/) (or a local Ethereum testnet / Geth node)
- [Git](https://git-scm.com/)

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd AuthentiFi
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Ensure local database credentials and test network endpoints are configured via environment variables or configuration files:
   - `PORT`: Server listening port (default: `8080`)
   - `database_user`: MySQL username
   - `database_password`: MySQL password
   - `secret`: Session encryption secret key

4. **Start the local server:**
   ```bash
   node server.js
   ```

---

## 6. Branching & Development Workflow

Do not commit directly to the `main` or `master` branch. All developments must occur on dedicated topic branches.

### Branch Naming Conventions
Use descriptive, lowercase branch names prefixed with the purpose:

| Prefix | Description | Example |
| :--- | :--- | :--- |
| `feature/` | Introducing new functionality | `feature/qr-scanner-integration` |
| `fix/` | Bug fixes or issue resolution | `fix/bcrypt-node-compatibility` |
| `refactor/` | Code improvements without altering behavior | `refactor/web3-provider-init` |
| `docs/` | Documentation, diagrams, or academic reports | `docs/architecture-flowchart` |
| `test/` | Adding or updating unit/integration tests | `test/smart-contract-tests` |

### Workflow Steps
1. Synchronize your local base branch:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create and switch to your feature branch:
   ```bash
   git checkout -b feature/<feature-name>
   ```
3. Implement changes, test locally, and stage your work.

---

## 7. Commit Message Conventions

We adhere to the **[Conventional Commits](https://www.conventionalcommits.org/)** specification to maintain an informative, clean git history.

### Format
```text
<type>(<optional-scope>): <subject>

[optional body]

[optional footer(s)]
```

### Commit Types
- **`feat`**: A new feature for the user or system
- **`fix`**: A bug fix
- **`docs`**: Documentation changes only (e.g., README, diagrams, reports)
- **`style`**: Formatting changes (white-space, linting, semicolons) that do not affect code logic
- **`refactor`**: Code restructuring without adding a feature or fixing a bug
- **`test`**: Adding missing tests or correcting existing tests
- **`chore`**: Maintenance tasks, package dependencies, or build scripts

### Examples
- `feat(auth): integrate bcryptjs password hashing`
- `fix(blockchain): handle web3 provider connection timeouts`
- `docs(readme): add ganache setup and deployment instructions`
- `refactor(server): modularize product verification routes`

---

## 8. Coding Standards & Best Practices

1. **Security & Secrets Hygiene (Crucial):**
   - **NEVER** commit private keys, mnemonic seed phrases, production passwords, or API keys into version control.
   - Use `.gitignore` to prevent leaking `.env`, private keystore files, or sensitive credentials.
2. **Readability & Comments:**
   - Write clean, self-documenting code.
   - Include meaningful docstrings and comments for smart contract functions and critical cryptographic/blockchain logic to aid peers and evaluators during project defense.
3. **Smart Contract Safety:**
   - Follow Solidity security guidelines (Checks-Effects-Interactions pattern, guard against reentrancy and integer overflow).
4. **Consistency:**
   - Follow consistent indentation (4 spaces or 2 spaces) and standard JavaScript (ES6+) syntax.

---

## 9. Submitting a Pull Request

Once your work is ready for review:

1. **Self-Review:**
   - Check your own diffs (`git diff`) to eliminate leftover debugging logs, commented-out dead code, or temporary files.
   - Verify that your local build runs without unhandled errors.

2. **Push to Remote:**
   ```bash
   git push origin feature/<feature-name>
   ```

3. **Open a Pull Request:**
   - Provide a clear, descriptive PR title (e.g., `feat(contracts): add ownership transfer event emission`).
   - Fill out the PR description with:
     - **Summary of Changes:** What was changed and why.
     - **Academic Relevance:** How this relates to the course requirements/milestones.
     - **Testing Performed:** Steps taken to verify functionality (e.g., Ganache transaction logs, screenshots).
   - Request at least one peer/teammate review before merging into `main`.

---

## 10. Licensing

By contributing to this repository, you agree that your contributions will be licensed under the **GNU General Public License v3.0 (GPL-3.0)** in accordance with the original project license. See the [LICENSE](LICENSE) file for complete terms.
