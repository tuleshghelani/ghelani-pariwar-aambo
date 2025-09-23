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
    // Create the hierarchical data structure from the provided family tree
    const personData: Person = {
      id: 'govindbhai',
      name: 'Govindbhai',
      children: [
        {
          id: 'kanabhai',
          name: 'Kanabhai',
          children: [
            {
              id: 'savajibhai',
              name: 'Savajibhai',
              children: [
                {
                  id: 'gopabhai',
                  name: 'Gopabhai',
                  children: [
                    {
                      id: 'dayabhai',
                      name: 'Dayabhai',
                      children: [
                        {
                          id: 'nathabhai',
                          name: 'Nathabhai',
                          children: [
                            {
                              id: 'madhabhai',
                              name: 'Madhabhai',
                              children: [
                                { id: 'akshay', name: 'Akshay' }
                              ]
                            },
                            {
                              id: 'rameshbhai',
                              name: 'Rameshbhai',
                              children: [
                                { id: 'abhay', name: 'Abhay' }
                              ]
                            },
                            { id: 'sureshbhai', name: 'Sureshbhai' }
                          ]
                        },
                        {
                          id: 'lavajibhai',
                          name: 'Lavajibhai',
                          children: [
                            {
                              id: 'nileshbhai',
                              name: 'Nileshbhai',
                              children: [
                                { id: 'harshbhai', name: 'Harshbhai' }
                              ]
                            },
                            {
                              id: 'rajeshbhai',
                              name: 'Rajeshbhai',
                              children: [
                                { id: 'ridhambhai', name: 'Ridhambhai' }
                              ]
                            }
                          ]
                        },
                        {
                          id: 'naranbhai',
                          name: 'Naranbhai',
                          children: [
                            { id: 'kalpeshbhai', name: 'Kalpeshbhai' },
                            { id: 'dilipbhai', name: 'Dilipbhai' }
                          ]
                        },
                      ]
                    },
                    {
                      id: 'jasmatbhai',
                      name: 'Jasmatbhai',
                      children: [
                        {
                          id: 'karsanbhai',
                          name: 'Karsanbhai',
                          children: [
                            {
                              id: 'vitthalbhai',
                              name: 'Vitthalbhai',
                              children: [
                                { id: 'kaushikbhai', name: 'Kaushikbhai' },
                                { id: 'rajubhai', name: 'Rajubhai' }
                              ]
                            }
                          ]
                        },
                        {
                          id: 'ghusabhai',
                          name: 'Ghusabhai',
                          children: [
                            {
                              id: 'rameshbhai',
                              name: 'Rameshbhai',
                              children: [
                                { id: 'tulesh', name: 'Tulesh' }
                              ]
                            },
                            {
                              id: 'parsottambhai',
                              name: 'Parsottambhai',
                              children: [
                                { id: 'vikesh', name: 'Vikesh' }
                              ]
                            }
                          ]
                        },
                      ]
                    },
                    {
                      id: 'kababhai',
                      name: 'Kababhai',
                      children: [
                        {
                          id: 'nanajibhai',
                          name: 'Nanajibhai',
                          children: [
                            {
                              id: 'raghubhai',
                              name: 'Raghubhai',
                              children: [
                                { id: 'jigneshbhai', name: 'Jigneshbhai' },
                                { id: 'vipulbhai', name: 'Vipulbhai' }
                              ]
                            },
                            {
                              id: 'sureshbhai',
                              name: 'Sureshbhai',
                              children: [
                                { id: 'sagarbhai', name: 'Sagarbhai' }
                              ]
                            }
                          ]
                        },
                        {
                          id: 'ramjibhai',
                          name: 'Ramjibhai',
                          children: [
                            {
                              id: 'jyedrabhai',
                              name: 'Jyedrabhai',
                              children: [
                                { id: 'harsh', name: 'Harsh' }
                              ]
                            },
                            {
                              id: 'mukeshbhai',
                              name: 'Mukeshbhai',
                              children: [
                                { id: 'deep', name: 'Deep' }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
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