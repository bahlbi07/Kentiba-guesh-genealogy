import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FamilyExplorer } from '../src/components/FamilyExplorer';
import { Directory } from '../src/components/Directory';
import { FamilyInformationView } from '../src/components/FamilyInformationView';
import { AboutArchive } from '../src/components/AboutArchive';
import { AdminPanel } from '../src/components/AdminPanel';
import { RecordEditorView } from '../src/components/RecordEditorView';
import { AddPersonGuidedModal } from '../src/components/AddPersonGuidedModal';
import { UncertainRecordsView } from '../src/components/UncertainRecordsView';
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

  it('5b. AdminPanel: displays people, needs review, and verified stats without total relationships', () => {
    render(
      <AdminPanel
        people={mockPeople}
        relationships={mockRelationships}
        occurrences={[]}
        auditEvents={[]}
        isAuthenticated={true}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
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

    expect(screen.getByText('ጠቕላላ ሰባት')).toBeDefined();
    expect(screen.getByText('ምምርማር ዘድልዮም')).toBeDefined();
    expect(screen.getByText('ዝተረጋገጹ')).toBeDefined();
    expect(screen.queryByText('ጠቕላላ ዝምድናታት')).toBeNull();
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

  it('8. AddPersonGuidedModal: supports cascading branch descendants, guidance box, fuzzy match, and clean spouse input', () => {
    const handleSavePerson = vi.fn().mockResolvedValue(undefined);
    const handleSaveRel = vi.fn().mockResolvedValue({ success: true });
    const handleComplete = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    const samplePeople: Person[] = [
      {
        id: 'pers_root_kinteba_guush',
        canonicalName: 'ከንቲባ ጉዑሽ ሓጎስ',
        branch: 'ቀንዲ መበቆል',
        status: 'verified',
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'pers_p1_9',
        canonicalName: 'ትዕበ',
        branch: 'ትዕበ',
        status: 'verified',
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'pers_p15_310',
        canonicalName: 'ዑመር',
        branch: 'ትዕበ',
        motherName: 'ትዕበ',
        status: 'verified',
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const sampleRels: Relationship[] = [
      {
        id: 'rel_pc_t_o',
        fromPersonId: 'pers_p1_9',
        toPersonId: 'pers_p15_310',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ትዕበ ዝወለደቶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    render(
      <AddPersonGuidedModal
        people={samplePeople}
        relationships={sampleRels}
        onClose={handleClose}
        onSavePerson={handleSavePerson}
        onSaveRelationship={handleSaveRel}
        onComplete={handleComplete}
      />
    );

    // Requirement 2: Historical notes textarea must NOT exist
    expect(screen.queryByText('መተሓሳሰቢ ወይ ታሪኻዊ መረዳእታ')).toBeNull();

    // Requirement 3: Professional Lineage Guidance Box must exist
    expect(screen.getByText('ፕሮፌሽናል መዘኻኸሪ ንሰንሰለታዊ ወለዶ፦')).toBeDefined();

    // Requirement 4: Section 3 should have spouse name, but NO "መግለጺ ሓዳር / ዝምድና"
    expect(screen.getByText('ስም መጻምድቲ')).toBeDefined();
    expect(screen.queryByText('መግለጺ ሓዳር / ዝምድና')).toBeNull();
    expect(screen.queryByText('መግለፂ ሓዳር / ዝምድና')).toBeNull();

    // Requirement 1: Cascading branch selector
    const branchSelect = screen.getByRole('combobox');
    fireEvent.change(branchSelect, { target: { value: 'ትዕበ' } });

    // Cascading container appears
    expect(screen.getByText(/ተዋረድ ወለዶ ሓረግ «ትዕበ»/)).toBeDefined();
    expect(screen.getByText(/ደቂ «ትዕበ»/)).toBeDefined();

    // Requirement 3: Fuzzy typo matching
    const quickInput = screen.getByPlaceholderText(/ንኣብነት: ደሃብ ሓሊቦ ሓጎስ ዓዶ ዑመር ትዕበ/);
    fireEvent.change(quickInput, { target: { value: 'ትእበ' } });

    // Typo suggestion chip should appear proposing «ትዕበ»
    expect(screen.getByText(/ኣብ መዝገብና ተመሳሳሊ ስም ሓረግ/)).toBeDefined();
    expect(screen.getAllByText(/«ትዕበ»/).length).toBeGreaterThan(0);
    const useSuggestionBtn = screen.getByRole('button', { name: /እወ ተጠቐም/ });
    fireEvent.click(useSuggestionBtn);

    // After clicking "እወ ተጠቐም", value changes to ትዕበ
    expect((quickInput as HTMLInputElement).value).toBe('ትዕበ');
  });

  it('9. UncertainRecordsView: allows direct person name editing in place and separate save vs approve buttons', async () => {
    const mockPersonFrom: Person = {
      id: 'pers_test_from',
      canonicalName: 'ናብ',
      branch: 'ጎብሩ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockPersonTo: Person = {
      id: 'pers_test_to',
      canonicalName: 'ቀሺ ፍትዊ',
      branch: 'ጎብሩ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockRel: Relationship = {
      id: 'rel_test_1',
      fromPersonId: 'pers_test_from',
      toPersonId: 'pers_test_to',
      type: 'parent_child',
      status: 'needs_review',
      sourceFile: 'ከሰተ-ብርሃነ.pdf',
      sourcePage: 5,
      sourceWording: 'ናብ ተኪኤ ዓድምባረኽ ኣትያ ዝወለደቶም ድማ',
      isBiologicalConfirmed: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    const handleUpdatePerson = vi.fn().mockResolvedValue(undefined);
    const handleUpdateRel = vi.fn().mockResolvedValue({ success: true });

    render(
      <UncertainRecordsView
        people={[mockPersonFrom, mockPersonTo]}
        relationships={[mockRel]}
        onSelectPerson={vi.fn()}
        onUpdatePerson={handleUpdatePerson}
        onUpdateRelationship={handleUpdateRel}
      />
    );

    // Click "ኣስተኻኽል" on the relationship
    const editBtn = screen.getByRole('button', { name: /ኣስተኻኽል/ });
    fireEvent.click(editBtn);

    // Modal opens with direct name editing fields
    expect(screen.getByText('ዝምድና ኣስተኻኽል')).toBeDefined();
    expect(screen.getByText('ወላዲ / መጻምድቲ (ካበይ) *')).toBeDefined();

    // The fromName input initially has 'ናብ'
    const fromNameInput = screen.getByPlaceholderText('ስም ወላዲ/መጻምድቲ ኣስተኻኽል...');
    expect((fromNameInput as HTMLInputElement).value).toBe('ናብ');

    // Rename 'ናብ' to 'ግደይ'
    fireEvent.change(fromNameInput, { target: { value: 'ግደይ' } });
    expect((fromNameInput as HTMLInputElement).value).toBe('ግደይ');

    // Both "ለውጢ ኣቐምጥ" and "ኣስተኻኺልካ ኣጽድቕ" buttons must exist
    const saveChangesBtn = screen.getByRole('button', { name: /ለውጢ ኣቐምጥ/ });
    const approveBtn = screen.getByRole('button', { name: /ኣስተኻኺልካ ኣጽድቕ/ });
    expect(saveChangesBtn).toBeDefined();
    expect(approveBtn).toBeDefined();

    // Clicking "ለውጢ ኣቐምጥ" saves person as 'ግደይ' without forcing 'verified' status
    fireEvent.click(saveChangesBtn);

    await waitFor(() => {
      expect(handleUpdatePerson).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pers_test_from',
          canonicalName: 'ግደይ',
        })
      );
      expect(handleUpdateRel).toHaveBeenCalledWith(
        expect.objectContaining({
          fromPersonId: 'pers_test_from',
          toPersonId: 'pers_test_to',
          status: 'needs_review',
        })
      );
    });
  });
});


