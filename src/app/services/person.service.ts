import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { Person } from '../models/person.model';
import { DataValidatorService } from './data-validator.service';

@Injectable({
  providedIn: 'root'
})
export class PersonService {
  constructor(private dataValidator: DataValidatorService) { }

  /**
   * Get hierarchical person data for the tree view
   * @returns Observable of Person data with parent-child relationships
   */
  getPersonHierarchy(): Observable<Person> {
    // Create the hierarchical data structure as specified
    const personData: Person = {
      id: 'Person101',
      name: 'Person101',
      children: [
        {
          id: 'Person201',
          name: 'Person201',
          children: [
            {
              id: 'Person301',
              name: 'Person301',
              children: [
                {
                  id: 'Person401',
                  name: 'Person401',
                  children: [
                    {
                      id: 'Person501',
                      name: 'Person501',
                      children: [
                        { id: 'Person601', name: 'Person601' },
                        { id: 'Person602', name: 'Person602' },
                        { id: 'Person603', name: 'Person603' }
                      ]
                    }
                  ]
                },
                {
                  id: 'Person402',
                  name: 'Person402',
                  children: [
                    {
                      id: 'Person502',
                      name: 'Person502',
                      children: [
                        { id: 'Person604', name: 'Person604' },
                        { id: 'Person605', name: 'Person605' },
                        { id: 'Person606', name: 'Person606' }
                      ]
                    }
                  ]
                },
                {
                  id: 'Person403',
                  name: 'Person403',
                  children: [
                    {
                      id: 'Person503',
                      name: 'Person503',
                      children: [
                        { id: 'Person607', name: 'Person607' },
                        { id: 'Person608', name: 'Person608' },
                        { id: 'Person609', name: 'Person609' }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'Person302',
              name: 'Person302',
              children: [
                {
                  id: 'Person404',
                  name: 'Person404',
                  children: [
                    {
                      id: 'Person504',
                      name: 'Person504',
                      children: [
                        { id: 'Person610', name: 'Person610' }
                      ]
                    }
                  ]
                },
                {
                  id: 'Person405',
                  name: 'Person405',
                  children: [
                    {
                      id: 'Person505',
                      name: 'Person505',
                      children: [
                        { id: 'Person611', name: 'Person611' },
                        { id: 'Person612', name: 'Person612' }
                      ]
                    },
                    {
                      id: 'Person506',
                      name: 'Person506',
                      children: [
                        { id: 'Person613', name: 'Person613' },
                        { id: 'Person614', name: 'Person614' }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: 'Person303',
              name: 'Person303'
            }
          ]
        }
      ]
    };

    // Validate the data structure and log any inconsistencies
    return of(personData).pipe(
      tap(data => {
        const validationErrors = this.dataValidator.validatePersonData(data);
        if (validationErrors.length > 0) {
          validationErrors.forEach(error => this.logError(error));
        }
      })
    );
  }

  /**
   * Log any errors or inconsistencies in the data
   * @param message Error message to log
   */
  logError(message: string): void {
    console.error(`[PersonService] ${message}`);
  }
}