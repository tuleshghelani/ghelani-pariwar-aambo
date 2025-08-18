import { Injectable } from '@angular/core';
import { Person } from '../models/person.model';

@Injectable({
  providedIn: 'root'
})
export class DataValidatorService {
  constructor() { }

  /**
   * Validate the person hierarchy data structure
   * @param data The person data to validate
   * @returns Array of error messages, empty if no errors
   */
  validatePersonData(data: Person): string[] {
    const errors: string[] = [];
    
    if (!data) {
      errors.push('Person data is null or undefined');
      return errors;
    }

    // Check root person
    if (!data.id) {
      errors.push('Root person is missing ID');
    }
    if (!data.name) {
      errors.push('Root person is missing name');
    }

    // Recursively validate children
    if (data.children && data.children.length > 0) {
      this.validateChildren(data.children, data.id, errors);
    }

    return errors;
  }

  /**
   * Recursively validate children in the hierarchy
   * @param children Array of child persons
   * @param parentId ID of the parent person
   * @param errors Array to collect error messages
   */
  private validateChildren(children: Person[], parentId: string, errors: string[]): void {
    // Check for duplicate IDs among siblings
    const ids = new Set<string>();
    children.forEach(child => {
      if (child.id) {
        if (ids.has(child.id)) {
          errors.push(`Duplicate ID ${child.id} found among children of ${parentId}`);
        } else {
          ids.add(child.id);
        }
      } else {
        errors.push(`Child of ${parentId} is missing ID`);
      }

      // Check for missing name
      if (!child.name) {
        errors.push(`Person ${child.id} is missing name`);
      }

      // Recursively validate grandchildren
      if (child.children && child.children.length > 0) {
        this.validateChildren(child.children, child.id, errors);
      }
    });
  }
}