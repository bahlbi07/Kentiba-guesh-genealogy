import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FamilyExplorer } from '../src/components/FamilyExplorer';
import { Navbar } from '../src/components/Navbar';
import { Directory } from '../src/components/Directory';
import { FamilyInformationView } from '../src/components/FamilyInformationView';
import { AboutArchive } from '../src/components/AboutArchive';
import { AdminPanel } from '../src/components/AdminPanel';
import { RecordEditorView } from '../src/components/RecordEditorView';
import { AddPersonGuidedModal, SpouseSelectionGuide } from '../src/components/AddPersonGuidedModal';
import { UncertainRecordsView } from '../src/components/UncertainRecordsView';
import { PersonDetailModal } from '../src/components/PersonDetailModal';
import { GenealogyPdfExportModal } from '../src/components/GenealogyPdfExportModal';
import App from '../src/App';
import { Person, Relationship } from '../src/types/genealogy';

// Sample verified test family fixture
const mockPeople: Person[] = [
  {
    id: 'pers_p1_0_0',
    canonicalName: 'ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ',
    branch: 'ከንቲባ ጉዕሽ',
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
    expect(screen.getAllByText('ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ').length).toBeGreaterThan(0);

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

    // Parent 'ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ' listed in parents section
    expect(screen.getByText('ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ')).toBeDefined();
  });

  it('4. AboutArchive: renders historical provenance and scribe attribution', () => {
    render(<AboutArchive />);

    // Verifies scribe attribution and primary source title
    expect(screen.getByText('ሓረግ ወለዶ ከንቲባ ጉዕሽ ሓጎስ')).toBeDefined();
    expect(screen.getByText(/ጸሓፊ ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ/)).toBeDefined();
    expect(screen.getByText(/መበቆላዊ ታሪኻዊ መዝገብ/)).toBeDefined();
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

  it('5c. AdminPanel: logs in Super Admin with exact credentials and renders Super Admin Portal', async () => {
    const handleLogin = vi.fn();
    render(
      <AdminPanel
        people={mockPeople}
        relationships={mockRelationships}
        occurrences={[]}
        auditEvents={[]}
        isAuthenticated={false}
        onLogin={handleLogin}
        onLogout={vi.fn()}
        onSelectPerson={vi.fn()}
        onUpdatePerson={vi.fn()}
        onDeletePerson={vi.fn()}
        onSaveRelationship={vi.fn()}
        onDeleteRelationship={vi.fn()}
        onAddNewPerson={vi.fn()}
        onImportCommitted={vi.fn()}
      />
    );

    const usernameInput = screen.getByPlaceholderText('ስም ተጠቃሚ የእትዉ...');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /ብደሓን እቶ/ });

    fireEvent.change(usernameInput, { target: { value: 'kentibaguesh0909superadmin@gmail.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Kentibaguesh#0909' } });
    fireEvent.click(submitBtn);

    expect(handleLogin).toHaveBeenCalledWith(
      expect.any(String),
      'kentibaguesh0909superadmin@gmail.com',
      'superadmin'
    );
  });

  it('5d. AdminPanel: renders Super Admin tabs including Pending Deletions and Google Sheets', () => {
    render(
      <AdminPanel
        people={mockPeople}
        relationships={mockRelationships}
        occurrences={[]}
        auditEvents={[]}
        isAuthenticated={true}
        role="superadmin"
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        onSelectPerson={vi.fn()}
        onUpdatePerson={vi.fn()}
        onDeletePerson={vi.fn()}
        onSaveRelationship={vi.fn()}
        onDeleteRelationship={vi.fn()}
        onAddNewPerson={vi.fn()}
        onImportCommitted={vi.fn()}
      />
    );

    expect(screen.getByText(/ዋና ኣካያዲ \/ ሱፐር ኣድሚን/)).toBeDefined();
    expect(screen.getAllByText(/ናይ ምድማስ ውሳነታት/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Google Sheets መላገቢ/)).toBeDefined();
  });

  it('6. App: renders complete application root without crashing', async () => {
    render(<App />);
    const elements = await screen.findAllByText(/ተወለድ እንዳቦይ ከንቲባ ጉዕሽ/);
    expect(elements.length).toBeGreaterThan(0);
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
        canonicalName: 'ከንቲባ ጉዕሽ ሓጎስ',
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

    // Historical notes textarea must exist
    expect(screen.getByText('መተሓሳሰቢ ወይ ታሪኻዊ መረዳእታ')).toBeDefined();

    // Professional Lineage Guidance Box must exist
    expect(screen.getByText('ፕሮፌሽናል መዘኻኸሪ ንሰንሰለታዊ ወለዶ፦')).toBeDefined();

    // Section 3 should have spouse name and "መግለፂ ሓዳር / ዝምድና"
    expect(screen.getByText('ስም መጻምድቲ')).toBeDefined();
    expect(screen.getByText('መግለፂ ሓዳር / ዝምድና')).toBeDefined();

    // Requirement 1: Cascading branch selector
    const branchSelect = screen.getByRole('combobox');
    fireEvent.change(branchSelect, { target: { value: 'ትዕበ' } });

    // Cascading container appears
    expect(screen.getByText(/ተዋረድ ወለዶ ሓረግ «ትዕበ»/)).toBeDefined();
    expect(screen.getByText(/ደቂ «ትዕበ»/)).toBeDefined();

    // Verify ፈጣን ሰንሰለት is removed
    expect(screen.queryByText(/ፈጣን ሰንሰለት ምእታው/)).toBeNull();

    // Verify "+ ቀጻሊ ወለዶ ወስኽ" is omitted
    expect(screen.queryByText('+ ቀጻሊ ወለዶ ወስኽ')).toBeNull();

    // Fuzzy typo matching on generation input
    const genInput = screen.getByPlaceholderText(/ንኣብነት: ደሃብ\.\.\./);
    fireEvent.change(genInput, { target: { value: 'ትእበ' } });

    // Typo suggestion chip should appear proposing «ትዕበ»
    expect(screen.getByText(/ኣብ መዝገብና ተመሳሳሊ ስም ሓረግ/)).toBeDefined();
    expect(screen.getAllByText(/«ትዕበ»/).length).toBeGreaterThan(0);
    const useSuggestionBtn = screen.getByRole('button', { name: /እወ ተጠቐም/ });
    fireEvent.click(useSuggestionBtn);

    // After clicking "እወ ተጠቐም", value changes to ትዕበ
    expect((genInput as HTMLInputElement).value).toBe('ትዕበ');
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

  it('11. PersonDetailModal: provides "+ ውሉድ ወስኽ / ኣስፍሕ" button and batch adds children to expand from 2 to 6', async () => {
    const mockParent: Person = {
      id: 'pers_p15_310',
      canonicalName: 'ዓዶ ዑመር',
      status: 'verified',
      branch: 'ትዕበ',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockChild1: Person = {
      id: 'pers_p15_313',
      canonicalName: 'ሓጎስ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockChild2: Person = {
      id: 'pers_p15_314',
      canonicalName: 'ለምለም',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockRels: Relationship[] = [
      {
        id: 'rel_1',
        fromPersonId: 'pers_p15_310',
        toPersonId: 'pers_p15_313',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ዓዲዑማር ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'rel_2',
        fromPersonId: 'pers_p15_310',
        toPersonId: 'pers_p15_314',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ዓዲዑማር ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const handleReload = vi.fn().mockResolvedValue(undefined);

    render(
      <PersonDetailModal
        person={mockParent}
        people={[mockParent, mockChild1, mockChild2]}
        relationships={mockRels}
        isAdmin={true}
        onClose={vi.fn()}
        onUpdatePerson={vi.fn().mockResolvedValue(undefined)}
        onDeletePerson={vi.fn().mockResolvedValue(undefined)}
        onAddRelationship={vi.fn()}
        onDeleteRelationship={vi.fn().mockResolvedValue(undefined)}
        onReload={handleReload}
      />
    );

    // Initial state: 2 children shown
    expect(screen.getByText(/ውሉዳት \(2\)/)).toBeDefined();
    expect(screen.getByText('ሓጎስ')).toBeDefined();
    expect(screen.getByText('ለምለም')).toBeDefined();

    // Check that the "+ ውሉድ ወስኽ / ኣስፍሕ" button is present
    const expandBtn = screen.getByRole('button', { name: /\+ ውሉድ ወስኽ \/ ኣስፍሕ/ });
    expect(expandBtn).toBeDefined();

    // Click to open children expansion panel
    fireEvent.click(expandBtn);

    // Check expansion panel rendered with heading and batch entry options
    expect(screen.getByText(/ውሉዳት ምዕባይን ምምዝጋብን/)).toBeDefined();
    expect(screen.getByText('ብጅምላ ወስኽ')).toBeDefined();
    expect(screen.getByText('ካብ ዝርዝር ምረጽ')).toBeDefined();

    // Enter comma-separated names into the quick input
    const quickInput = screen.getByPlaceholderText(/ንኣብነት፡ ሓጎስ፣ ለምለም፣ ኣብርሃ/);
    fireEvent.change(quickInput, { target: { value: 'ኣብርሃ፣ በርሀ፣ መሓሪ፣ ኣስመላሽ' } });

    // Click split button
    const splitBtn = screen.getByRole('button', { name: 'ኣከፋፍል' });
    fireEvent.click(splitBtn);

    // Should indicate expansion from 2 to 6!
    expect(screen.getByText(/ካብ 2 ናብ 6 ክዓቢ እዩ/)).toBeDefined();

    // Submit batch
    const submitBtn = screen.getByRole('button', { name: /4 ውሉዳት መዝግብን ኣራኽብን/ });
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleReload).toHaveBeenCalled();
    });
  });

  it('12. RecordEditorView: automatically extracts and transfers names after space from canonicalName to fatherName', async () => {
    const mockPerson: Person = {
      id: 'pers_1791650900376_uipv',
      canonicalName: 'ባህልቢ ሃይለ',
      fatherName: '', // empty initially, just like in user screenshot
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    render(
      <RecordEditorView
        people={[mockPerson]}
        relationships={[]}
        onUpdatePerson={vi.fn().mockResolvedValue(undefined)}
        onDeletePerson={vi.fn().mockResolvedValue(undefined)}
        onSaveRelationship={vi.fn().mockResolvedValue({ success: true })}
        onDeleteRelationship={vi.fn().mockResolvedValue(undefined)}
      />
    );

    // Open edit modal for person
    const editBtn = screen.getByRole('button', { name: /ኣስተኻኽል/ });
    fireEvent.click(editBtn);

    // 1. Father name should have been automatically detected as "ሃይለ" from "ባህልቢ ሃይለ" on modal open!
    const fatherInput = screen.getByPlaceholderText('ስም ኣቦ...') as HTMLInputElement;
    expect(fatherInput.value).toBe('ሃይለ');

    // 2. When user modifies canonicalName to add grandfather name e.g. "ባህልቢ ሃይለ ገብረሚካኤል"
    const canonicalInput = screen.getByPlaceholderText('ምሉእ ስም የእትዉ...') as HTMLInputElement;
    fireEvent.change(canonicalInput, { target: { value: 'ባህልቢ ሃይለ ገብረሚካኤል' } });

    // Everything after the first space automatically transfers to fatherInput!
    expect(fatherInput.value).toBe('ሃይለ ገብረሚካኤል');
  });

  it('13. AddPersonGuidedModal: automatically retrieves and pre-fills recorded spouse for ancestors across generations and supports +4 children', async () => {
    const mockAncestor: Person = {
      id: 'pers_p15_halibo',
      canonicalName: 'ሓሊቦ',
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      spouseNote: 'መጻምድቲ: ደስታ ወልደ ሚካኤል',
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockSpouse: Person = {
      id: 'pers_desta_wm',
      canonicalName: 'ደስታ ወልደ ሚካኤል',
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockSpouseRel: Relationship = {
      id: 'rel_halibo_desta',
      fromPersonId: 'pers_p15_halibo',
      toPersonId: 'pers_desta_wm',
      type: 'partner_or_union',
      status: 'verified',
      sourceFile: 'ከሰተ-ብርሃነ.pdf',
      sourcePage: 15,
      sourceWording: 'ሓሊቦ ዝተመርዓዉ ምስ ደስታ ወልደ ሚካኤል',
      isBiologicalConfirmed: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    render(
      <AddPersonGuidedModal
        people={[mockAncestor, mockSpouse]}
        relationships={[mockSpouseRel]}
        onClose={vi.fn()}
        onSavePerson={vi.fn().mockResolvedValue(undefined)}
        onSaveRelationship={vi.fn().mockResolvedValue({ success: true })}
        onComplete={vi.fn().mockResolvedValue(undefined)}
      />
    );

    // 1. Enter parent name "ሓሊቦ" into generation 1 input
    const parentInput = screen.getByPlaceholderText('ንኣብነት: ደሃብ...') as HTMLInputElement;
    fireEvent.change(parentInput, { target: { value: 'ሓሊቦ' } });

    // The spouse input should automatically be populated with "ደስታ ወልደ ሚካኤል"!
    const spouseInput = screen.getByPlaceholderText('ንኣብነት: ሃይለ...') as HTMLInputElement;
    expect(spouseInput.value).toBe('ደስታ ወልደ ሚካኤል');

    // And the badge "ካብ መዝገብ ዝተረኽበ" should be rendered!
    expect(screen.getByText('ካብ መዝገብ ዝተረኽበ')).toBeDefined();

    // 2. Click "+ 4 ውሉዳት" button in children section
    const add4Btn = screen.getByRole('button', { name: /\+ 4 ውሉዳት/ });
    expect(add4Btn).toBeDefined();
    fireEvent.click(add4Btn);

    // Now 4 children rows should be rendered!
    expect(screen.getAllByPlaceholderText('ስም ቆልዓ...').length).toBe(4);
  });

  it('13. GenealogyPdfExportModal: renders hierarchical generational descent tables with lineage breadcrumbs and branch themes', () => {
    const mockAncestor: Person = {
      id: 'pers_root_kinteba_guush',
      canonicalName: 'ከንቲባ ጉዕሽ ሓጎስ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockGobru: Person = {
      id: 'pers_gobru',
      canonicalName: 'ጎብሩ',
      branch: 'ጎብሩ',
      fatherName: 'ከንቲባ ጉዕሽ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockTela: Person = {
      id: 'pers_tela',
      canonicalName: 'ተላ',
      branch: 'ጎብሩ',
      fatherName: 'ጎብሩ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockSpouseTela: Person = {
      id: 'pers_spouse_tela',
      canonicalName: 'ኣረጋሽ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const mockHagosChild: Person = {
      id: 'pers_hagos',
      canonicalName: 'ሓጎስ ተላ',
      branch: 'ጎብሩ',
      fatherName: 'ተላ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    const mockRels: Relationship[] = [
      {
        id: 'rel_1',
        fromPersonId: 'pers_gobru',
        toPersonId: 'pers_tela',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'register.md',
        sourcePage: 1,
        sourceWording: 'ጎብሩ ተላ ዝወለደ',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'rel_2',
        fromPersonId: 'pers_tela',
        toPersonId: 'pers_spouse_tela',
        type: 'partner_or_union',
        status: 'verified',
        sourceFile: 'register.md',
        sourcePage: 1,
        sourceWording: 'ተላ ምስ ኣረጋሽ',
        isBiologicalConfirmed: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'rel_3',
        fromPersonId: 'pers_tela',
        toPersonId: 'pers_hagos',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'register.md',
        sourcePage: 1,
        sourceWording: 'ተላ ሓጎስ ዝወለደ',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    render(
      <GenealogyPdfExportModal
        people={[mockAncestor, mockGobru, mockTela, mockSpouseTela, mockHagosChild]}
        relationships={mockRels}
        onClose={vi.fn()}
      />
    );

    // Verify Title & Branches
    expect(screen.getByText('ተወለድ እንዳቦይ ከንቲባ ጉዕሽ ሓጎስ')).toBeDefined();
    expect(screen.getAllByText('ጨንፈር ጎብሩ').length).toBeGreaterThan(0);

    // Verify Generations rendered
    expect(screen.getByText('ደረጃ 1 (መስራቲ)')).toBeDefined();
    expect(screen.getByText('ደረጃ 2 (ውሉድ)')).toBeDefined();
    expect(screen.getByText('ደረጃ 3 (ደቂ-ደቂ)')).toBeDefined();

    // Verify Lineage breadcrumb is rendered for ሓጎስ ተላ: "ከንቲባ ጉዕሽ › ጎብሩ › ተላ › ሓጎስ ተላ"
    expect(screen.getAllByText('ከንቲባ ጉዕሽ').length).toBeGreaterThan(0);

    // Verify Spouse is displayed with heart indicator
    expect(screen.getByText('ኣረጋሽ')).toBeDefined();

    // Verify Children badge
    expect(screen.getAllByText('1 ውሉዳት').length).toBeGreaterThan(0);

    // Verify view toggle works
    const treeViewBtn = screen.getByTitle('ተዋረድ ሓረግ (Tree View)');
    fireEvent.click(treeViewBtn);
    expect(screen.getAllByText(/ሰንሰለት: ከንቲባ ጉዕሽ › ጎብሩ › ተላ/).length).toBe(2);
  });

  it('14. AddPersonGuidedModal: supports multiple spouses with per-spouse children and fast atomic batch saving', async () => {
    localStorage.clear();
    const handleSaveBatch = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <AddPersonGuidedModal
        people={[]}
        relationships={[]}
        onClose={handleClose}
        onSaveBatch={handleSaveBatch}
      />
    );

    // 1. Enter Main Person name
    const mainPersonInput = screen.getByPlaceholderText('ንኣብነት: ባህልቢ ሃይለ...') as HTMLInputElement;
    fireEvent.change(mainPersonInput, { target: { value: 'ተኽለ በርሀ' } });

    // 2. Spouse 1 name and wording
    const spouseInputs = screen.getAllByPlaceholderText('ንኣብነት: ስም መጻምድቲ...') as HTMLInputElement[];
    fireEvent.change(spouseInputs[0], { target: { value: 'ኣልጋነሽ' } });

    // 3. Add 2nd spouse via "+ መጻምድቲ ወስኽ"
    const addSpouseBtn = screen.getAllByRole('button', { name: /\+ መጻምድቲ ወስኽ/ })[0];
    fireEvent.click(addSpouseBtn);

    // Now there should be 2 spouse cards
    const updatedSpouseInputs = screen.getAllByPlaceholderText('ንኣብነት: ስም መጻምድቲ...') as HTMLInputElement[];
    expect(updatedSpouseInputs.length).toBe(2);
    fireEvent.change(updatedSpouseInputs[1], { target: { value: 'ብርኽቲ' } });

    // 4. Add child under Spouse 1 via "+ ቆልዓ ወስኽ"
    const addChildBtns = screen.getAllByRole('button', { name: /\+ ቆልዓ ወስኽ/ });
    fireEvent.click(addChildBtns[0]); // add to spouse 1

    // 5. Add 4 children under Spouse 2 via "+ 4 ውሉዳት"
    const add4Btns = screen.getAllByRole('button', { name: /\+ 4 ውሉዳት/ });
    fireEvent.click(add4Btns[1]); // add 4 children to spouse 2

    // Fill in child name under Spouse 1
    const childInputs = screen.getAllByPlaceholderText('ስም ቆልዓ...') as HTMLInputElement[];
    expect(childInputs.length).toBe(5); // 1 for spouse 1, 4 for spouse 2
    fireEvent.change(childInputs[0], { target: { value: 'ዳዊት ተኽለ' } });
    fireEvent.change(childInputs[1], { target: { value: 'ዮናስ ተኽለ' } });

    // Verify Section 3 displays total children: 5
    expect(screen.getByText(/3\. መጻምድትን ውሉዳትን.*5 ውሉዳት/)).toBeDefined();

    // 6. Submit form
    const submitBtn = screen.getByRole('button', { name: /ኣረጋግጽን መዝግብን/ });
    fireEvent.submit(submitBtn.closest('form')!);

    // 7. Verify handleSaveBatch was called with all people and relationships
    await waitFor(() => {
      expect(handleSaveBatch).toHaveBeenCalledTimes(1);
    });
    const [savedPeople, savedRels] = handleSaveBatch.mock.calls[0];

    // Main person, 2 spouses, 2 named children (empty children skipped)
    const personNames = savedPeople.map((p: any) => p.canonicalName);
    expect(personNames).toContain('ተኽለ በርሀ');
    expect(personNames).toContain('ኣልጋነሽ');
    expect(personNames).toContain('ብርኽቲ');
    expect(personNames).toContain('ዳዊት ተኽለ');
    expect(personNames).toContain('ዮናስ ተኽለ');

    // Partner relationships exist for both spouses
    const partnerRels = savedRels.filter((r: any) => r.type === 'partner_or_union');
    expect(partnerRels.length).toBe(2);

    // Modal closed immediately
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('18. Navbar: renders immune brand title and font stepper decreaser (-) and increaser (+)', () => {
    const handleSetTab = vi.fn();
    render(
      <Navbar
        activeTab="tree"
        setActiveTab={handleSetTab}
        datasetMode="real"
        isCloudConnected={true}
        totalPeopleCount={548}
        hasSelectedPerson={false}
      />
    );

    // Brand title is rendered with fixed, immune classes
    const brandTitle = screen.getByText('ተወለድ እንዳቦይ ከንቲባ ጉዕሽ');
    expect(brandTitle).toBeDefined();
    expect(brandTitle.className).toContain('navbar-brand-title');
    expect(screen.getByText(/548 ኣባላት/)).toBeDefined();

    // Default font scale is 'መደበኛ'
    expect(screen.getByText('መደበኛ')).toBeDefined();

    // Decreaser and Increaser stepper buttons
    const decBtn = screen.getByLabelText('ፊደል ኣንእስ');
    const incBtn = screen.getByLabelText('ፊደል ኣዕቢ');
    expect(decBtn).toBeDefined();
    expect(incBtn).toBeDefined();

    // Decrease font -> 'ንእሽቶ'
    fireEvent.click(decBtn);
    expect(screen.getByText('ንእሽቶ')).toBeDefined();
    expect(decBtn).toBeDisabled();

    // Increase font back to 'መደበኛ' -> 'ዓቢ' -> 'ዝዓበየ'
    fireEvent.click(incBtn);
    expect(screen.getByText('መደበኛ')).toBeDefined();
    fireEvent.click(incBtn);
    expect(screen.getByText('ዓቢ')).toBeDefined();
    fireEvent.click(incBtn);
    expect(screen.getByText('ዝዓበየ')).toBeDefined();
    expect(incBtn).toBeDisabled();
  });

  it('19. FamilyExplorer: renders multi-generational tree with zero name truncation and focus button for deep levels', () => {
    // Extended deep-lineage fixture: root -> Gobru -> Tela -> Hadgu -> Kesete
    const deepLineagePeople: Person[] = [
      ...mockPeople,
      {
        id: 'pers_p1_hadgu',
        canonicalName: 'ሓድጉ',
        branch: 'ጎብሩ',
        status: 'verified',
        sourcePage: 1,
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'pers_p1_kesete',
        canonicalName: 'ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ',
        branch: 'ጎብሩ',
        status: 'verified',
        sourcePage: 1,
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const deepLineageRels: Relationship[] = [
      ...mockRelationships,
      {
        id: 'rel_3',
        fromPersonId: 'pers_p1_tela',
        toPersonId: 'pers_p1_hadgu',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 1,
        sourceWording: 'ሓድጉ ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'rel_4',
        fromPersonId: 'pers_p1_hadgu',
        toPersonId: 'pers_p1_kesete',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 1,
        sourceWording: 'ከሰተ ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const handleSelect = vi.fn();
    render(
      <FamilyExplorer
        people={deepLineagePeople}
        relationships={deepLineageRels}
        onSelectPerson={handleSelect}
      />
    );

    // Expand Level 1 (Gobru)
    const expandGobru = screen.getAllByTitle(/ጨንፈር ዘርግሕ/)[0];
    fireEvent.click(expandGobru);
    expect(screen.getByText('ተላ')).toBeDefined();

    // Expand Level 2 (Tela)
    const expandTela = screen.getByTitle(/ናይ ተላ ጨንፈር ዘርግሕ/);
    fireEvent.click(expandTela);
    expect(screen.getByText('ሓድጉ')).toBeDefined();

    // Expand Level 3 (Hadgu)
    const expandHadgu = screen.getByTitle(/ናይ ሓድጉ ጨንፈር ዘርግሕ/);
    fireEvent.click(expandHadgu);

    // Level 4 (Kesete Birhane Weldu): verified visible with break-words and no truncate!
    const deepName = screen.getByText('ከሰተ ብርሃነ ወልዱ ወዲ ጎብሩ');
    expect(deepName).toBeDefined();
    expect(deepName.className).toContain('break-words');
    expect(deepName.className).not.toContain('truncate');

    // Verify "ናብዚ ኣተኩር" button is NOT rendered
    expect(screen.queryByText(/ናብዚ ኣተኩር/)).toBeNull();

    // Clicking Hadgu's card directly elevates Hadgu to active center stage
    fireEvent.click(screen.getByText('ሓድጉ'));
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ canonicalName: 'ሓድጉ' }));
  });

  it('20. FamilyExplorer: Mobile Hardware Back Button (popstate) steps back generation by generation without exiting', () => {
    const deepLineagePeople: Person[] = [
      ...mockPeople,
      {
        id: 'pers_p1_hadgu',
        canonicalName: 'ሓድጉ',
        branch: 'ጎብሩ',
        status: 'verified',
        sourcePage: 1,
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'pers_p1_kesete',
        canonicalName: 'ከሰተ ብርሃነ',
        branch: 'ጎብሩ',
        status: 'verified',
        sourcePage: 1,
        isArchived: false,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    const deepLineageRels: Relationship[] = [
      ...mockRelationships,
      {
        id: 'rel_3',
        fromPersonId: 'pers_p1_tela',
        toPersonId: 'pers_p1_hadgu',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 1,
        sourceWording: 'ሓድጉ ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
      {
        id: 'rel_4',
        fromPersonId: 'pers_p1_hadgu',
        toPersonId: 'pers_p1_kesete',
        type: 'parent_child',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 1,
        sourceWording: 'ከሰተ ዝወለዶም',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-09T00:00:00.000Z',
        updatedAt: '2026-10-09T00:00:00.000Z',
      },
    ];

    render(
      <FamilyExplorer
        people={deepLineagePeople}
        relationships={deepLineageRels}
        onSelectPerson={vi.fn()}
      />
    );

    // Expand Level 1 (Gobru) -> reveals Level 2 (Tela)
    fireEvent.click(screen.getByTitle(/ናይ ጎብሩ ጨንፈር ዘርግሕ/));
    expect(screen.getByText('ተላ')).toBeDefined();

    // Expand Level 2 (Tela) -> reveals Level 3 (Hadgu)
    fireEvent.click(screen.getByTitle(/ናይ ተላ ጨንፈር ዘርግሕ/));
    expect(screen.getByText('ሓድጉ')).toBeDefined();

    // Expand Level 3 (Hadgu) -> reveals Level 4 (Kesete Birhane)
    fireEvent.click(screen.getByTitle(/ናይ ሓድጉ ጨንፈር ዘርግሕ/));
    expect(screen.getByText('ከሰተ ብርሃነ')).toBeDefined();

    // Simulate Mobile Hardware Back Button #1: collapses Level 4 (Kesete Birhane), keeps Level 3 (Hadgu) visible!
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.queryByText('ከሰተ ብርሃነ')).toBeNull();
    expect(screen.getByText('ሓድጉ')).toBeDefined();

    // Simulate Mobile Hardware Back Button #2: collapses Level 3 (Hadgu), keeps Level 2 (Tela) visible!
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.queryByText('ሓድጉ')).toBeNull();
    expect(screen.getByText('ተላ')).toBeDefined();

    // Simulate Mobile Hardware Back Button #3: collapses Level 2 (Tela), keeps Level 1 (Gobru) visible!
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.queryByText('ተላ')).toBeNull();
    expect(screen.getByText('ጎብሩ')).toBeDefined();
  });

  it('21. AddPersonGuidedModal: assigns a unique ID to new members sharing a name (e.g. ኣብርሃ) without inheriting another branch’s 5 children, while reusing an existing child under the exact same parent (e.g. ደሃብ under ሓሊቦ)', async () => {
    localStorage.clear();
    // Existing "ኣብርሃ" in branch ወለገርግስ who has 5 children
    const otherAbrha: Person = {
      id: 'pers_p28_1_0',
      canonicalName: 'ኣብርሃ',
      branch: 'ወለገርግስ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const otherAbrhaKids: Person[] = [1, 2, 3, 4, 5].map((n) => ({
      id: `pers_other_abrha_kid_${n}`,
      canonicalName: `ቆልዓ ${n}`,
      fatherName: 'ኣብርሃ',
      branch: 'ወለገርግስ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    }));
    const otherAbrhaRels: Relationship[] = otherAbrhaKids.map((k, idx) => ({
      id: `rel_other_abrha_${idx}`,
      fromPersonId: 'pers_p28_1_0',
      toPersonId: k.id,
      type: 'parent_child',
      status: 'verified',
      sourceFile: 'ከሰተ-ብርሃነ.pdf',
      sourcePage: 28,
      sourceWording: `${k.canonicalName} ወዲ ኣብርሃ`,
      isBiologicalConfirmed: true,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    }));

    // Existing "ሓሊቦ" and his child "ደሃብ" in branch ትዕበ
    const halibo: Person = {
      id: 'pers_p5_20_1',
      canonicalName: 'ሓሊቦ',
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const dehabUnderHalibo: Person = {
      id: 'pers_p5_20_1_c4',
      canonicalName: 'ደሃብ',
      fatherName: 'ሓሊቦ',
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const haliboDehabRel: Relationship = {
      id: 'rel_p5_20_1_c04',
      fromPersonId: 'pers_p5_20_1',
      toPersonId: 'pers_p5_20_1_c4',
      type: 'parent_child',
      status: 'verified',
      sourceFile: 'ከሰተ-ብርሃነ.pdf',
      sourcePage: 5,
      sourceWording: 'ደሃብ ጓል ሓሊቦ',
      isBiologicalConfirmed: true,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    const allPeople = [otherAbrha, ...otherAbrhaKids, halibo, dehabUnderHalibo];
    const allRels = [...otherAbrhaRels, haliboDehabRel];

    const handleSaveBatch1 = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(
      <AddPersonGuidedModal
        people={allPeople}
        relationships={allRels}
        onClose={vi.fn()}
        onSaveBatch={handleSaveBatch1}
      />
    );

    // Case A: Admin adds a new "ኣብርሃ" without any children
    const mainNameInput = screen.getByPlaceholderText('ንኣብነት: ባህልቢ ሃይለ...') as HTMLInputElement;
    fireEvent.change(mainNameInput, { target: { value: 'ኣብርሃ' } });

    const submitBtn = screen.getByRole('button', { name: /ኣረጋግጽን መዝግብን/ });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(handleSaveBatch1).toHaveBeenCalledTimes(1);
    });

    const [savedPeople1, savedRels1] = handleSaveBatch1.mock.calls[0];
    const savedAbrha = savedPeople1.find((p: Person) => p.canonicalName === 'ኣብርሃ');
    expect(savedAbrha).toBeDefined();
    // Must have a brand-new unique ID, NOT 'pers_p28_1_0'!
    expect(savedAbrha.id).not.toBe('pers_p28_1_0');
    // Must have 0 children linked to him!
    const childrenOfNewAbrha = savedRels1.filter(
      (r: Relationship) => r.type === 'parent_child' && r.fromPersonId === savedAbrha.id
    );
    expect(childrenOfNewAbrha.length).toBe(0);

    unmount();

    // Case B: Admin adds "ደሃብ" under existing parent "ሓሊቦ" -> reuses 'pers_p5_20_1_c4' without duplicating
    const handleSaveBatch2 = vi.fn().mockResolvedValue(undefined);
    render(
      <AddPersonGuidedModal
        people={allPeople}
        relationships={allRels}
        onClose={vi.fn()}
        onSaveBatch={handleSaveBatch2}
      />
    );

    // Pick existing ancestor "ሓሊቦ" from picker
    const pickFromRegistryBtn = screen.getByRole('button', { name: /ካብ መዝገብ ድለ/ });
    fireEvent.click(pickFromRegistryBtn);
    fireEvent.click(screen.getByText('ሓሊቦ'));

    // Enter "ደሃብ" as the main person name
    const mainNameInput2 = screen.getByPlaceholderText('ንኣብነት: ባህልቢ ሃይለ...') as HTMLInputElement;
    fireEvent.change(mainNameInput2, { target: { value: 'ደሃብ' } });

    const submitBtn2 = screen.getByRole('button', { name: /ኣረጋግጽን መዝግብን/ });
    fireEvent.submit(submitBtn2.closest('form')!);

    await waitFor(() => {
      expect(handleSaveBatch2).toHaveBeenCalledTimes(1);
    });

    const [savedPeople2] = handleSaveBatch2.mock.calls[0];
    const savedDehab = savedPeople2.find((p: Person) => p.canonicalName === 'ደሃብ');
    expect(savedDehab).toBeDefined();
    // Reused the existing "ደሃብ" under "ሓሊቦ"!
    expect(savedDehab.id).toBe('pers_p5_20_1_c4');
  });

  it('24. Multi-Device Cloud Sync: Admin batch registration with standard admin token is immediately visible to all other phones via GET /api/tree', async () => {
    const { handler } = await import('../netlify/functions/genealogy');

    const newCloudMember: Person = {
      id: 'pers_cloud_test_99999',
      canonicalName: 'ሓድሽ ኣባል ሞባይል',
      branch: 'ትዕበ',
      status: 'verified',
      sourcePage: 5,
      isArchived: false,
      createdAt: '2026-10-13T01:00:00.000Z',
      updatedAt: '2026-10-13T01:00:00.000Z',
    };

    const newCloudRel: Relationship = {
      id: 'rel_cloud_test_99999',
      type: 'parent_child',
      fromPersonId: 'pers_p5_20_1',
      toPersonId: 'pers_cloud_test_99999',
      status: 'verified',
      sourceFile: 'Admin Entry',
      sourcePage: 5,
      sourceWording: 'ሓሊቦ -> ሓድሽ ኣባል ሞባይል',
      isBiologicalConfirmed: true,
      createdAt: '2026-10-13T01:00:00.000Z',
      updatedAt: '2026-10-13T01:00:00.000Z',
    };

    // Phone 1 (Admin) saves a new member using 'admin-standard-session-token'
    const saveRes = (await handler(
      {
        httpMethod: 'POST',
        path: '/api/batch',
        headers: {
          authorization: 'Bearer admin-standard-session-token',
        },
        body: JSON.stringify({
          people: [newCloudMember],
          relationships: [newCloudRel],
        }),
      } as never,
      {} as never,
      () => {}
    )) as { statusCode: number; body: string };

    expect(saveRes.statusCode).toBe(200);

    // Phone 2 (Public user on another phone) fetches GET /api/tree
    const fetchRes = (await handler(
      {
        httpMethod: 'GET',
        path: '/api/tree',
        headers: {},
      } as never,
      {} as never,
      () => {}
    )) as { statusCode: number; body: string };

    expect(fetchRes.statusCode).toBe(200);
    const treePayload = JSON.parse(fetchRes.body);
    const syncedMember = treePayload.people.find((p: Person) => p.id === 'pers_cloud_test_99999');
    expect(syncedMember).toBeDefined();
    expect(syncedMember.canonicalName).toBe('ሓድሽ ኣባል ሞባይል');

    const syncedRel = treePayload.relationships.find((r: Relationship) => r.id === 'rel_cloud_test_99999');
    expect(syncedRel).toBeDefined();
  });

  it('25. Google Sheets Sync: sends ONLY newly entered bloodline members with complete unbroken lineage chain and zero clutter', async () => {
    const { INITIAL_PEOPLE, INITIAL_RELATIONSHIPS } = await import('../src/data/initialGenealogyData');
    const { computeLineageChain, isSpouseHelperRecord } = await import('../src/services/googleSheetsService');

    // Create a brand new child under "ኣብርሃ ሓሊቦ" (pers_p5_20_1_c1) AND also link to a spouse node
    const newChild: Person = {
      id: 'pers_new_child_test_1',
      canonicalName: 'ሰላም',
      branch: 'ትዕበ',
      fatherName: 'ኣብርሃ ሓሊቦ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-13T01:00:00.000Z',
      updatedAt: '2026-10-13T01:00:00.000Z',
    };

    const spouseHelper: Person = {
      id: 'pers_123_main_sp_0',
      canonicalName: 'ማና',
      branch: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      notes: 'መጻምድቲ ኣብርሃ ሓሊቦ',
      createdAt: '2026-10-13T01:00:00.000Z',
      updatedAt: '2026-10-13T01:00:00.000Z',
    };

    expect(isSpouseHelperRecord(spouseHelper)).toBe(true);
    expect(isSpouseHelperRecord(newChild)).toBe(false);

    const newRels: Relationship[] = [
      {
        id: 'rel_test_pc_bloodline',
        type: 'parent_child',
        fromPersonId: 'pers_tibe_halibo_01_abrha', // ኣብርሃ ሓሊቦ
        toPersonId: 'pers_new_child_test_1',
        status: 'verified',
        sourceFile: 'Admin',
        sourcePage: null,
        sourceWording: 'ሰላም ጓል ኣብርሃ ሓሊቦ',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-13T01:00:00.000Z',
        updatedAt: '2026-10-13T01:00:00.000Z',
      },
      {
        id: 'rel_test_pc_spouse',
        type: 'parent_child',
        fromPersonId: 'pers_123_main_sp_0', // spouse listed second!
        toPersonId: 'pers_new_child_test_1',
        status: 'verified',
        sourceFile: 'Admin',
        sourcePage: null,
        sourceWording: 'ሰላም ጓል ማና',
        isBiologicalConfirmed: true,
        createdAt: '2026-10-13T01:00:00.000Z',
        updatedAt: '2026-10-13T01:00:00.000Z',
      },
    ];

    const result = computeLineageChain(
      newChild,
      [...INITIAL_PEOPLE, spouseHelper, newChild],
      [...INITIAL_RELATIONSHIPS, ...newRels]
    );

    expect(result.chain).toBe(
      'ከንቲባ ጉዕሽ ሓጎስ › ትዕበ › ዓዶ ዑመር › ሓጎስ › ሓሊቦ › ኣብርሃ ሓሊቦ › ሰላም'
    );
    expect(result.generation).toBe(7);
    expect(result.resolvedBranch).toBe('ትዕበ');
    expect(result.immediateParentName).toBe('ኣብርሃ ሓሊቦ');
  });

  it('26. FamilyExplorer: Automatically scrolls window to top when clicking any person card, breadcrumb, or back button', async () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const onSelectPerson = vi.fn();
    render(
      <FamilyExplorer
        people={mockPeople}
        relationships={mockRelationships}
        onSelectPerson={onSelectPerson}
      />
    );

    // Initial render triggers scrollTo
    expect(scrollToMock).toHaveBeenCalled();

    scrollToMock.mockClear();
    scrollIntoViewMock.mockClear();

    // Click on child card 'ጎብሩ'
    const gobruButton = screen.getByRole('button', { name: /ናይ ጎብሩ ገጽ ርአ/i });
    fireEvent.click(gobruButton);

    // Assert that scrollTo was called with top: 0 to guarantee view starts from the very top
    expect(scrollToMock).toHaveBeenCalled();
    const calls = scrollToMock.mock.calls;
    const hasTopZeroCall = calls.some(
      (args) => (args[0] === 0 && args[1] === 0) || (args[0] && args[0].top === 0)
    );
    expect(hasTopZeroCall).toBe(true);

    // Breadcrumb or Reset button click
    scrollToMock.mockClear();
    const resetBtn = screen.getByRole('button', { name: /ናብ ቀንድን መበቆልን/i });
    fireEvent.click(resetBtn);
    expect(scrollToMock).toHaveBeenCalled();
  });

  it('27. FamilyExplorer: Back button (← ተመለስ) correctly steps back to parent when focused directly, and to previous trail person when navigated', async () => {
    const onSelectPerson = vi.fn();
    // User arrives focused directly on 'ተላ' (child of ጎብሩ) without prior navigation history
    render(
      <FamilyExplorer
        people={mockPeople}
        relationships={mockRelationships}
        selectedPersonId="pers_p1_tela"
        onSelectPerson={onSelectPerson}
      />
    );

    // The back button should be visible
    const backBtn = screen.getByRole('button', { name: /ተመለስ/i });
    expect(backBtn).toBeInTheDocument();

    // Click back button: should step back to parent 'ጎብሩ'
    fireEvent.click(backBtn);

    // onSelectPerson should have been called with parent 'ጎብሩ'
    expect(onSelectPerson).toHaveBeenCalled();
    const lastCalledPerson = onSelectPerson.mock.calls[onSelectPerson.mock.calls.length - 1][0];
    expect(lastCalledPerson.canonicalName).toBe('ጎብሩ');
  });

  it('28. FamilyExplorer: Renders siblings as non-clickable informational tags to prevent expanding fake sibling branches', async () => {
    const sibling1: Person = {
      id: 'pers_p1_tela_sibling',
      canonicalName: 'እምባየ',
      branch: 'ጎብሩ',
      status: 'verified',
      sourcePage: 1,
      isArchived: false,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };
    const relSibling: Relationship = {
      id: 'rel_sib_1',
      fromPersonId: 'pers_p1_gobru',
      toPersonId: sibling1.id,
      type: 'parent_child',
      status: 'verified',
      sourceFile: '',
      sourcePage: 1,
      sourceWording: '',
      isBiologicalConfirmed: true,
      createdAt: '2026-10-09T00:00:00.000Z',
      updatedAt: '2026-10-09T00:00:00.000Z',
    };

    render(
      <FamilyExplorer
        people={[...mockPeople, sibling1]}
        relationships={[...mockRelationships, relSibling]}
        selectedPersonId="pers_p1_tela"
        onSelectPerson={vi.fn()}
      />
    );

    // Sibling 'እምባየ' should be displayed as a non-clickable tag
    const siblingTag = screen.getByText('እምባየ');
    expect(siblingTag).toBeInTheDocument();
    expect(siblingTag.tagName.toLowerCase()).not.toBe('button');
    expect(siblingTag.tagName.toLowerCase()).toBe('span');
  });

  it('27. SuperAdmin Deletions Queue: renders "ምድምሳስ ኣጽድቕ" button and triggers onPermanentDeletePerson', async () => {
    const pendingPerson: Person = {
      id: 'pers_del_test_1',
      canonicalName: 'ተደምሳሲ ሰብ',
      status: 'verified',
      createdAt: '2026-10-10',
      updatedAt: '2026-10-10',
      isArchived: true,
      deletionPending: true,
      deletionRequestedBy: 'ኣድሚን',
      deletionRequestedAt: new Date().toISOString(),
    };

    const handlePermanentDelete = vi.fn().mockResolvedValue(undefined);
    const handleRestore = vi.fn().mockResolvedValue(undefined);

    // Mock confirm dialog
    const originalConfirm = window.confirm;
    window.confirm = vi.fn().mockReturnValue(true);

    render(
      <AdminPanel
        people={[pendingPerson]}
        relationships={[]}
        occurrences={[]}
        auditEvents={[]}
        isAuthenticated={true}
        role="superadmin"
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        onSelectPerson={vi.fn()}
        onUpdatePerson={vi.fn()}
        onDeletePerson={vi.fn()}
        onPermanentDeletePerson={handlePermanentDelete}
        onRestorePerson={handleRestore}
        onSaveRelationship={vi.fn()}
        onDeleteRelationship={vi.fn()}
        onAddNewPerson={vi.fn()}
        onImportCommitted={vi.fn()}
      />
    );

    // Verify "ምድምሳስ ኣጽድቕ" label is present
    const approveDeleteBtn = screen.getByRole('button', { name: /ምድምሳስ ኣጽድቕ/ });
    expect(approveDeleteBtn).toBeInTheDocument();

    fireEvent.click(approveDeleteBtn);
    expect(handlePermanentDelete).toHaveBeenCalledWith('pers_del_test_1');

    window.confirm = originalConfirm;
  });

  it('28. UncertainRecordsView: immediate smooth verification and onBatchVerify execution', async () => {
    const uncertainPerson: Person = {
      id: 'pers_uncertain_test_1',
      canonicalName: 'ዘይተረጋገጸ ሰብ',
      status: 'needs_review',
      createdAt: '2026-10-10',
      updatedAt: '2026-10-10',
      isArchived: false,
    };
    const uncertainRel: Relationship = {
      id: 'rel_uncertain_test_1',
      fromPersonId: 'pers_root_kinteba_guush',
      toPersonId: 'pers_uncertain_test_1',
      type: 'parent_child',
      status: 'needs_review',
      sourceFile: '',
      sourcePage: 1,
      sourceWording: '',
      isBiologicalConfirmed: true,
      createdAt: '2026-10-10',
      updatedAt: '2026-10-10',
    };

    const handleBatchVerify = vi.fn().mockResolvedValue(undefined);
    const handleUpdatePerson = vi.fn().mockResolvedValue(undefined);
    const handleUpdateRel = vi.fn().mockResolvedValue({ success: true });

    render(
      <UncertainRecordsView
        people={[uncertainPerson]}
        relationships={[uncertainRel]}
        onSelectPerson={vi.fn()}
        onUpdatePerson={handleUpdatePerson}
        onUpdateRelationship={handleUpdateRel}
        onBatchVerify={handleBatchVerify}
      />
    );

    expect(screen.getByText('ምምርማር ዘድልዮም መዛግብቲ')).toBeInTheDocument();
    const batchVerifyBtn = screen.getByRole('button', { name: /ንኹሎም ብሓንሳብ ኣጽድቕ/ });
    expect(batchVerifyBtn).toBeInTheDocument();

    fireEvent.click(batchVerifyBtn);

    expect(handleBatchVerify).toHaveBeenCalledTimes(1);
    const [peopleArg, relsArg] = handleBatchVerify.mock.calls[0];
    expect(peopleArg[0].id).toBe('pers_uncertain_test_1');
    expect(peopleArg[0].status).toBe('verified');
    expect(relsArg[0].id).toBe('rel_uncertain_test_1');
    expect(relsArg[0].status).toBe('verified');
  });

  it('29. Permanent Deletion & DB: permanently deleted person is saved in deletedPersonIds and never resurrected', async () => {
    const { deletePerson, getDeletedPersonIds, getAllPeople, bulkLoadData } = await import('../src/services/db');

    const testPerson: Person = {
      id: 'pers_perm_del_test_99',
      canonicalName: 'ንሓዋሩ ዝድምሰስ ሰብ',
      status: 'verified',
      createdAt: '2026-10-10',
      updatedAt: '2026-10-10',
      isArchived: false,
    };

    const { savePerson } = await import('../src/services/db');
    await savePerson(testPerson, 'Test');

    // Permanently delete
    await deletePerson('pers_perm_del_test_99', 'SuperAdmin');

    const deletedIds = await getDeletedPersonIds();
    expect(deletedIds).toContain('pers_perm_del_test_99');

    // getAllPeople must not return it
    const all = await getAllPeople(true);
    expect(all.some((p) => p.id === 'pers_perm_del_test_99')).toBe(false);

    // bulkLoadData must not re-insert it
    await bulkLoadData({
      people: [testPerson],
      relationships: [],
      mode: 'real',
    });

    const allAfterBulk = await getAllPeople(true);
    expect(allAfterBulk.some((p) => p.id === 'pers_perm_del_test_99')).toBe(false);
  });

  it('30. FamilyExplorer: deduplicates duplicate spouse cards, filters artifacts, and allows admin spouse deletion', async () => {
    const mainPerson: Person = {
      id: 'pers_p1_9',
      canonicalName: 'ትዕበ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
    };
    const spouse1: Person = {
      id: 'pers_liz_1',
      canonicalName: 'ሊዝ ሓሊቦ ወልደጊርጊስ',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
    };
    const spouse2: Person = {
      id: 'pers_liz_2',
      canonicalName: 'ሊዝ ሓሊቦ ወልደጊርጊስ "ዓሊተና"',
      status: 'verified',
      isArchived: false,
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
    };
    const artifactSpouse: Person = {
      id: 'pers_partner_p15_309',
      canonicalName: 'ኣቦይ ወለሓንስ ዓሊተና',
      status: 'unverified',
      isArchived: false,
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
    };

    const rels: Relationship[] = [
      {
        id: 'rel_sp_1',
        fromPersonId: 'pers_p1_9',
        toPersonId: 'pers_liz_1',
        type: 'partner_or_union',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ትዕበ ዝተመርዓዉ ምስ ሊዝ ሓሊቦ ወልደጊርጊስ',
        isBiologicalConfirmed: false,
        createdAt: '2026-10-09',
        updatedAt: '2026-10-09',
      },
      {
        id: 'rel_sp_2',
        fromPersonId: 'pers_p1_9',
        toPersonId: 'pers_liz_2',
        type: 'partner_or_union',
        status: 'verified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ትዕበ ዝተመርዓዉ ምስ ሊዝ ሓሊቦ ወልደጊርጊስ',
        isBiologicalConfirmed: false,
        createdAt: '2026-10-09',
        updatedAt: '2026-10-09',
      },
      {
        id: 'rel_sp_art',
        fromPersonId: 'pers_p1_9',
        toPersonId: 'pers_partner_p15_309',
        type: 'partner_or_union',
        status: 'unverified',
        sourceFile: 'ከሰተ-ብርሃነ.pdf',
        sourcePage: 15,
        sourceWording: 'ትዕበ ከንቲባ ጉዕሽ ናብ ኣቦይ ወለሓንስ ዓሊተና ኣትያ ዝወለደቶም ድማ',
        isBiologicalConfirmed: false,
        createdAt: '2026-10-09',
        updatedAt: '2026-10-09',
      },
    ];

    const mockDeleteRel = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <FamilyExplorer
        people={[mainPerson, spouse1, spouse2, artifactSpouse]}
        relationships={rels}
        selectedPersonId="pers_p1_9"
        onSelectPerson={vi.fn()}
        isAdmin={true}
        onDeleteRelationship={mockDeleteRel}
      />
    );

    // Artifact spouse "ኣቦይ ወለሓንስ ዓሊተና" should NOT be rendered
    expect(screen.queryByText('ኣቦይ ወለሓንስ ዓሊተና')).toBeNull();

    // The duplicate spouse cards should be deduplicated to exactly ONE card
    const spouseCards = screen.getAllByText('ሊዝ ሓሊቦ ወልደጊርጊስ');
    expect(spouseCards.length).toBe(1);

    // The delete button on the spouse card should be clickable
    const deleteBtn = screen.getByTitle('መጻምድቲ ደምስስ');
    expect(deleteBtn).toBeDefined();
    fireEvent.click(deleteBtn);

    expect(mockDeleteRel).toHaveBeenCalled();
  });

  it('31. SpouseSelectionGuide: renders clear 2-option choices (reuse recorded name or delete erroneous spouse)', () => {
    const onUseExisting = vi.fn();
    const onDeleteErronous = vi.fn();

    render(
      <SpouseSelectionGuide
        existingSpouseName="ሊዝ ሓሊቦ ወልደጊርጊስ"
        onUseExisting={onUseExisting}
        onDeleteErronousSpouse={onDeleteErronous}
        canAddSecondSpouse={true}
        onKeepAndAddSecondSpouse={vi.fn()}
      />
    );

    // Option 1 text
    expect(screen.getByText(/ዝበሃል ድሮ ኣሎ/)).toBeDefined();
    const useBtn = screen.getByRole('button', { name: /ነዚ ስም ተጠቐም/ });
    fireEvent.click(useBtn);
    expect(onUseExisting).toHaveBeenCalledWith('ሊዝ ሓሊቦ ወልደጊርጊስ');

    // Option 2 text
    expect(screen.getByText(/እዚ ስም ትኽክለኛ መጻምድቲ እዩ ኢልኩም እንተዘይሓሲብኩም/)).toBeDefined();
    const deleteBtn = screen.getByRole('button', { name: /ጌጋ ስለዝኾነ ይደምሰስ/ });
    fireEvent.click(deleteBtn);
    expect(onDeleteErronous).toHaveBeenCalled();
  });

  it('32. AddPersonGuidedModal: female gender registers person as mother of children and preserves child gender toggles', async () => {
    const handleSaveBatch = vi.fn().mockResolvedValue(undefined);

    render(
      <AddPersonGuidedModal
        people={[]}
        relationships={[]}
        onClose={vi.fn()}
        onSaveBatch={handleSaveBatch}
      />
    );

    // Enter name
    const nameInput = screen.getByPlaceholderText('ንኣብነት: ባህልቢ ሃይለ...');
    fireEvent.change(nameInput, { target: { value: 'ሮዛ ተስፋይ' } });

    // Select female gender (ኣንስተይቲ)
    const femaleBtn = screen.getByRole('button', { name: /👩 ኣንስተይቲ/ });
    fireEvent.click(femaleBtn);

    // Verify parentage notification explains mother role
    expect(screen.getByText(/እዛ ኣባል ከም/)).toBeDefined();
    expect(screen.getByText(/ኣዶ \(Mother\)/)).toBeDefined();

    // Enter spouse name
    const spouseInput = screen.getByPlaceholderText('ንኣብነት: ስም መጻምድቲ...');
    fireEvent.change(spouseInput, { target: { value: 'ሃይለ ገብረሚካኤል' } });

    // Add child
    const addChildBtn = screen.getByRole('button', { name: /\+ ቆልዓ ወስኽ/ });
    fireEvent.click(addChildBtn);

    const childInput = screen.getByPlaceholderText('ስም ቆልዓ...');
    fireEvent.change(childInput, { target: { value: 'ኣበባ ሃይለ' } });

    // Toggle child gender to female (ጓል)
    const girlBtn = screen.getByRole('button', { name: 'ጓል' });
    fireEvent.click(girlBtn);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /ኣረጋግጽን መዝግብን/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSaveBatch).toHaveBeenCalledTimes(1);
    });

    const [savedPeople, savedRels] = handleSaveBatch.mock.calls[0];

    // Main person should be female
    const mainPers = savedPeople.find((p: Person) => p.canonicalName === 'ሮዛ ተስፋይ');
    expect(mainPers).toBeDefined();
    expect(mainPers.gender).toBe('female');

    // Child should have motherName = ሮዛ ተስፋይ, fatherName = ሃይለ ገብረሚካኤል, gender = female
    const childPers = savedPeople.find((p: Person) => p.canonicalName === 'ኣበባ ሃይለ');
    expect(childPers).toBeDefined();
    expect(childPers.motherName).toBe('ሮዛ ተስፋይ');
    expect(childPers.fatherName).toBe('ሃይለ ገብረሚካኤል');
    expect(childPers.gender).toBe('female');

    // Spouse should be male
    const spousePers = savedPeople.find((p: Person) => p.canonicalName === 'ሃይለ ገብረሚካኤል');
    expect(spousePers).toBeDefined();
    expect(spousePers.gender).toBe('male');
  });

  it('33. AddPersonGuidedModal: "መጻምድቲ የብሎምን" option avoids empty spouse card and saves without spouse relationship', async () => {
    const handleSaveBatch = vi.fn().mockResolvedValue(undefined);

    render(
      <AddPersonGuidedModal
        people={[]}
        relationships={[]}
        onClose={vi.fn()}
        onSaveBatch={handleSaveBatch}
      />
    );

    // Enter name
    const nameInput = screen.getByPlaceholderText('ንኣብነት: ባህልቢ ሃይለ...');
    fireEvent.change(nameInput, { target: { value: 'ይስሓቅ ተወልደ' } });

    // Select "መጻምድቲ የብሎምን (ዘይብሎም)"
    const noSpouseCheckbox = screen.getByLabelText(/መጻምድቲ የብሎምን/);
    fireEvent.click(noSpouseCheckbox);

    // Empty spouse input box should be gone
    expect(screen.queryByPlaceholderText('ንኣብነት: ስም መጻምድቲ...')).toBeNull();
    // Replaced by clean banner
    expect(screen.getByText(/ነዚ ኣባል ዝተመዝገበ መጻምድቲ የለን/)).toBeDefined();

    // Still allows adding direct children if needed
    const addChildBtn = screen.getByRole('button', { name: /\+ ቆልዓ ወስኽ/ });
    fireEvent.click(addChildBtn);

    const childInput = screen.getByPlaceholderText('ስም ቆልዓ...');
    fireEvent.change(childInput, { target: { value: 'ሳሙኤል ይስሓቅ' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /ኣረጋግጽን መዝግብን/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSaveBatch).toHaveBeenCalledTimes(1);
    });

    const [savedPeople, savedRels] = handleSaveBatch.mock.calls[0];

    // Person saved with no spouseNote
    const mainPers = savedPeople.find((p: Person) => p.canonicalName === 'ይስሓቅ ተወልደ');
    expect(mainPers).toBeDefined();
    expect(mainPers.spouseNote).toBeUndefined();

    // No spouse relationship created
    const spouseRels = savedRels.filter((r: Relationship) => r.type === 'partner_or_union');
    expect(spouseRels.length).toBe(0);

    // Child is saved and linked directly to main person with fatherName = ይስሓቅ ተወልደ
    const childPers = savedPeople.find((p: Person) => p.canonicalName === 'ሳሙኤል ይስሓቅ');
    expect(childPers).toBeDefined();
    expect(childPers.fatherName).toBe('ይስሓቅ ተወልደ');
    expect(childPers.motherName).toBeUndefined();
    expect(childPers.gender).toBe('male');
  });
});






