import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FamilyExplorer } from '../src/components/FamilyExplorer';
import { Directory } from '../src/components/Directory';
import { FamilyInformationView } from '../src/components/FamilyInformationView';
import { AboutArchive } from '../src/components/AboutArchive';
import { AdminPanel } from '../src/components/AdminPanel';
import { RecordEditorView } from '../src/components/RecordEditorView';
import App from '../src/App';
import { Person, Relationship } from '../src/types/genealogy';

// Sample verified test family fixture
const mockPeople: Person[] = [
  {
    id: 'pers_p1_0_0',
    canonicalName: 'ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ',
    branch: 'ከንቲባ ጉዑሽ',
    status: 'verified',
    sourcePage: 1,
    isArchived: false,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  {
    id: 'pers_p1_gobru',
    canonicalName: 'ጎብሩ',
    branch: 'ጎብሩ',
    status: 'verified',
    sourcePage: 1,
    isArchived: false,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  {
    id: 'pers_p1_habtu_1',
    canonicalName: 'ሃብቱ',
    branch: 'ጎብሩ',
    status: 'verified',
    sourcePage: 1,
    isArchived: false,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  {
    id: 'pers_p3_habtu_2',
    canonicalName: 'ሃብቱ',
    branch: 'ኣድሓነት',
    status: 'needs_review',
    sourcePage: 3,
    isArchived: false,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  {
    id: 'pers_p1_tela',
    canonicalName: 'ተላ',
    branch: 'ጎብሩ',
    status: 'verified',
    sourcePage: 1,
    isArchived: false,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
];

const mockRelationships: Relationship[] = [
  {
    id: 'rel_1',
    fromPersonId: 'pers_p1_0_0',
    toPersonId: 'pers_p1_gobru',
    type: 'parent_child',
    status: 'verified',
    sourceFile: 'ከሰተ-ብርሃነ.pdf',
    sourcePage: 1,
    sourceWording: 'ጎብሩ ከንቲባ ጉዕሽ ዝወለዶም',
    isBiologicalConfirmed: true,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  {
    id: 'rel_2',
    fromPersonId: 'pers_p1_gobru',
    toPersonId: 'pers_p1_tela',
    type: 'parent_child',
    status: 'verified',
    sourceFile: 'ከሰተ-ብርሃነ.pdf',
    sourcePage: 1,
    sourceWording: 'ተላ ዝወለዶም',
    isBiologicalConfirmed: true,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
];

describe('UI Navigation, Tree Interaction, and Safety Verification', () => {
  it('1. FamilyExplorer: renders focused person and expands/collapses child branch in-place', () => {
    const handleSelect = vi.fn();
    const handleOpenDetails = vi.fn();

    render(
      <FamilyExplorer
        people={mockPeople}
        relationships={mockRelationships}
        onSelectPerson={handleSelect}
        onOpenDetails={handleOpenDetails}
      />
    );

    // Verify root is rendered on center stage and breadcrumb
    expect(screen.getAllByText('ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ').length).toBeGreaterThan(0);

    // Verify child 'ጎብሩ' is visible
    expect(screen.getByText('ጎብሩ')).toBeDefined();

    // The child 'ጎብሩ' has a child ('ተላ'), so it should have an expand control
    const expandBtns = screen.getAllByTitle(/ጨንፈር ዘርግሕ|Expand branch/);
    expect(expandBtns.length).toBeGreaterThan(0);

    // Click expand
    fireEvent.click(expandBtns[0]);

    // Verify grandchild 'ተላ' is now revealed
    expect(screen.getByText('ተላ')).toBeDefined();

    // Click collapse
    const collapseBtns = screen.getAllByTitle(/ጨንፈር ዓጽፍ|Collapse branch/);
    fireEvent.click(collapseBtns[0]);

    // Verify 'ተላ' is hidden
    expect(screen.queryByText('ናይ ጎብሩ ውሉዳት:')).toBeNull();
  });

  it('2. Directory: searches Tigrinya names and distinguishes repeated names without merging', () => {
    const handleSelect = vi.fn();
    const handleAdd = vi.fn();

    render(
      <Directory
        people={mockPeople}
        relationships={mockRelationships}
        onSelectPerson={handleSelect}
        onAddNewPerson={handleAdd}
      />
    );

    // Search for repeated name 'ሃብቱ'
    const searchInput = screen.getByPlaceholderText('ብሽም፣ ብስም ኣቦ ወይ መፍለዪ ቁጽሪ ድለዩ...');
    fireEvent.change(searchInput, { target: { value: 'ሃብቱ' } });

    // Both distinct occurrences must be present separately!
    const habtuElements = screen.getAllByText('ሃብቱ');
    expect(habtuElements.length).toBe(2);

    // One is in branch 'ጎብሩ' and the other in 'ኣድሓነት'
    expect(screen.getByText('ጎብሩ')).toBeDefined();
    expect(screen.getByText('ኣድሓነት')).toBeDefined();
  });

  it('3. FamilyInformationView: opens and displays person details accurately', () => {
    const handleSelect = vi.fn();
    const handleExplore = vi.fn();

    render(
      <FamilyInformationView
        person={mockPeople[1]} // ጎብሩ
        people={mockPeople}
        relationships={mockRelationships}
        onSelectPerson={handleSelect}
        onExploreInTree={handleExplore}
      />
    );

    // Canonical name displayed (appears in h1 and branch tag)
    expect(screen.getAllByText('ጎብሩ').length).toBeGreaterThan(0);

    // Branch displayed
    expect(screen.getByText('ጎብሩ', { selector: 'strong' })).toBeDefined();

    // Child 'ተላ' listed in children section
    expect(screen.getByText('ተላ')).toBeDefined();

    // Parent 'ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ' listed in parents section
    expect(screen.getByText('ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ')).toBeDefined();
  });

  it('4. AboutArchive: renders historical provenance and scribe attribution', () => {
    render(<AboutArchive />);

    // Verifies scribe attribution and primary source title
    expect(screen.getByText('ሓረግ ወለዶ ከንቲባ ጉዑሽ ሓጎስ')).toBeDefined();
    expect(screen.getByText(/ጸሓፊ ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ/)).toBeDefined();
    expect(screen.getByText(/ከሰተ-ብርሃነ\.pdf/)).toBeDefined();
  });

  it('5. AdminPanel: enforces authentication gate and rejects invalid credentials with generic message', async () => {
    const handleLogin = vi.fn();
    const handleLogout = vi.fn();

    render(
      <AdminPanel
        people={mockPeople}
        relationships={mockRelationships}
        occurrences={[]}
        auditEvents={[]}
        isAuthenticated={false}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSelectPerson={vi.fn()}
        onUpdatePerson={vi.fn()}
        onDeletePerson={vi.fn()}
        onSaveRelationship={vi.fn()}
        onDeleteRelationship={vi.fn()}
        onAddNewPerson={vi.fn()}
        onAddNewRelationship={vi.fn()}
        onImportCommitted={vi.fn()}
      />
    );

    // Initial state: Login form rendered
    expect(screen.getByText('ናይ መዛግብቲ ኣካያዲ መእተዊ')).toBeDefined();

    // Attempt login with invalid password
    const usernameInput = screen.getByPlaceholderText('ስም ተጠቃሚ የእትዉ...');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /ብደሓን እቶ/ });

    fireEvent.change(usernameInput, { target: { value: 'archivist' } });
    fireEvent.change(passwordInput, { target: { value: 'bad' } }); // under 6 chars
    fireEvent.click(submitBtn);

    // Generic error message shown, login rejected
    expect(await screen.findByText(/መእተዊ ሓበሬታ ትክክል ኣይኮነን/)).toBeDefined();
    expect(handleLogin).not.toHaveBeenCalled();
  });

  it('6. App: renders complete application root without crashing', async () => {
    render(<App />);
    expect(await screen.findByText(/ተወለድ እንዳቦይ ከንትባ ጉዕሽ/)).toBeDefined();
  });

  it('7. RecordEditorView: searches people and opens edit modal to correct misspelled data', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    const handleDelete = vi.fn().mockResolvedValue(undefined);
    const handleSaveRel = vi.fn().mockResolvedValue({ success: true });
    const handleDeleteRel = vi.fn().mockResolvedValue(undefined);

    render(
      <RecordEditorView
        people={mockPeople}
        relationships={mockRelationships}
        onUpdatePerson={handleUpdate}
        onDeletePerson={handleDelete}
        onSaveRelationship={handleSaveRel}
        onDeleteRelationship={handleDeleteRel}
      />
    );

    // Initial table renders
    expect(screen.getByText('መመዓራረዪ መዝገብ ወለዶ')).toBeDefined();
    expect(screen.getAllByText('ጎብሩ').length).toBeGreaterThan(0);

    // Find and click the edit button for a person
    const editBtns = screen.getAllByRole('button', { name: /ኣስተኻኽል/ });
    expect(editBtns.length).toBeGreaterThan(0);
    fireEvent.click(editBtns[0]);

    // Modal opens
    expect(screen.getByText(/መረዳእታ ምስትኻኻል/)).toBeDefined();

    // Check input fields exist
    const nameInput = screen.getByDisplayValue(mockPeople[0].canonicalName);
    expect(nameInput).toBeDefined();

    // Make an edit and submit
    fireEvent.change(nameInput, { target: { value: 'ሓረግ ወለዶ ዝተዓረየ' } });
    const saveBtn = screen.getByRole('button', { name: /ለውጢ ኣቐምጥ/ });
    fireEvent.click(saveBtn);

    expect(handleUpdate).toHaveBeenCalledTimes(1);
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalName: 'ሓረግ ወለዶ ዝተዓረየ',
      })
    );
  });
});

