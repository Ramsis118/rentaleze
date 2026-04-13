# Contributing to Rentaleze

Thank you for your interest in contributing to Rentaleze! This document provides guidelines and instructions for contributing.

## 🤝 Code of Conduct

By participating, you are expected to:
- Be respectful and considerate
- Avoid destructive criticism
- Focus on constructive feedback
- Show empathy towards other contributors

## 🎯 Ways to Contribute

### Report Bugs
- Check if bug already exists
- Provide clear description
- Include steps to reproduce
- Include expected vs actual behavior
- Attach screenshots if relevant

### Suggest Features
- Search existing suggestions first
- Provide clear use case
- Explain the problem it solves
- Be open to discussion

### Code Contributions
- Fix bugs
- Add new features
- Improve documentation
- Optimize performance
- Write tests

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/rentaleze.git
cd rentaleze

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_USERNAME/rentaleze.git

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/amazing-feature
```

### Development Workflow

```bash
# Start development servers
npm run dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Code Style

We use:
- **ESLint** for JavaScript linting
- **Prettier** for code formatting
- **Tailwind CSS** for styling

Run linting:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

### Testing

```bash
# Run tests
npm test

# Run specific test
npm test -- ListingCard

# Run with coverage
npm run test -- --coverage
```

## 📝 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new booking flow
fix: resolve cart calculation bug
docs: update API documentation
style: improve mobile responsiveness
refactor: optimize listing queries
test: add checkout tests
chore: update dependencies
```

## 🔀 Pull Request Process

### 1. Keep Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Create Branch

```bash
git checkout -b type/short-description
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### 3. Make Changes

- Write code following existing patterns
- Add tests for new features
- Update documentation
- Run linting and tests

### 4. Commit

```bash
git add .
git commit -m "type: description"
```

### 5. Push & Create PR

```bash
git push origin type/short-description
```

Open a Pull Request on GitHub with:
- Clear title
- Description of changes
- Reference any issues
- Screenshots for UI changes

## 📋 Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Testing
Describe testing done

## Screenshots
(if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console warnings/errors
```

## 🐛 Reporting Issues

Use GitHub Issues with:

**Bug Report:**
```markdown
### Description
[Clear description]

### Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

### Expected Behavior
[What should happen]

### Actual Behavior
[What happens instead]

### Screenshots
[If applicable]

### Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Node: [e.g., 18.0]
```

**Feature Request:**
```markdown
### Problem
[Problem you're trying to solve]

### Proposed Solution
[Your proposed solution]

### Use Case
[Specific use case]

### Alternatives Considered
[Any alternatives you've considered]