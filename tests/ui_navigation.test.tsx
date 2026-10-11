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
import { PersonDetailModal } from '../src/components/PersonDetailModal';
import { GenealogyPdfExportModal } from '../src/components/GenealogyPdfExportModal';
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
    const elements = await screen.findAllByText(/ተወለድ እንዳቦይ ከንትባ ጉዕሽ/);
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
    expect(screen.getByText('4. ውሉዳት (4)')).toBeDefined();
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
    expect(screen.getByText('ተወለድ እንዳቦይ ከንትባ ጉዕሽ ሓጎስ')).toBeDefined();
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
});



