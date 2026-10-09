import { Relationship } from '../types/genealogy';

/**
 * Validates whether adding or modifying a parent_child relationship creates a circular hierarchy.
 * @param existingRelationships All current relationships in the dataset
 * @param proposedFromId The parent person ID
 * @param proposedToId The child person ID
 * @param currentRelationshipId Optional ID if editing an existing relationship
 * @returns { isValid: boolean, error?: string }
 */
export function validateParentChildCycle(
  existingRelationships: Relationship[],
  proposedFromId: string,
  proposedToId: string,
  currentRelationshipId?: string
): { isValid: boolean; error?: string } {
  if (!proposedFromId || !proposedToId) {
    return { isValid: false, error: 'Both parent and child IDs must be specified.' };
  }

  if (proposedFromId === proposedToId) {
    return { isValid: false, error: 'A person cannot be their own parent/child (self-referencing cycle).' };
  }

  // Build directed adjacency map for parent -> child links
  // We ignore non-parent_child relationships and the relationship currently being edited
  const parentToChildren = new Map<string, string[]>();

  for (const rel of existingRelationships) {
    if (rel.type !== 'parent_child') continue;
    if (currentRelationshipId && rel.id === currentRelationshipId) continue;

    const children = parentToChildren.get(rel.fromPersonId) || [];
    children.push(rel.toPersonId);
    parentToChildren.set(rel.fromPersonId, children);
  }

  // Add the proposed link: proposedFromId -> proposedToId
  const proposedChildren = parentToChildren.get(proposedFromId) || [];
  parentToChildren.set(proposedFromId, [...proposedChildren, proposedToId]);

  // Check if proposedFromId can reach itself or if proposedToId can reach proposedFromId
  // In a valid DAG, proposedToId must NOT be an ancestor of proposedFromId.
  // Breadth-first search starting from proposedToId following parent->child links
  const visited = new Set<string>();
  const queue = [proposedToId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === proposedFromId) {
      return {
        isValid: false,
        error: `Circular relationship detected: person "${proposedToId}" is already an ancestor of person "${proposedFromId}". Adding this parent-child link would create an impossible generational loop.`
      };
    }

    if (!visited.has(current)) {
      visited.add(current);
      const nextChildren = parentToChildren.get(current) || [];
      for (const child of nextChildren) {
        if (!visited.has(child)) {
          queue.push(child);
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates referential integrity: ensures both person IDs exist in the people list.
 */
export function validateReferentialIntegrity(
  peopleIds: Set<string>,
  fromId: string,
  toId: string
): { isValid: boolean; error?: string } {
  if (!peopleIds.has(fromId)) {
    return { isValid: false, error: `Referential integrity error: Source person ID "${fromId}" does not exist.` };
  }
  if (!peopleIds.has(toId)) {
    return { isValid: false, error: `Referential integrity error: Target person ID "${toId}" does not exist.` };
  }
  return { isValid: true };
}

