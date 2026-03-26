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
                                { id: 'akshaybhai', name: 'Akshaybhai' }
                              ]
                            },
                            {
                              id: 'rameshbhai',
                              name: 'Rameshbhai',
                              children: [
                                { id: 'abhaybhai', name: 'Abhaybhai' }
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
                            { id: 'kalpeshbhai', name: 'Kalpeshbhai',
                              children: [
                                { id: 'jashbhai', name: 'Jashbhai' }
                              ]
                             },
                            { id: 'dilipbhai', name: 'Dilipbhai',
                              children: [
                                { id: 'Shivanshbhai', name: 'Shivanshbhai' }
                              ]
                             }
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
                                { 
                                  id: 'kaushikbhai', name: 'Kaushikbhai',
                                  children: [
                                    { id: 'Nakshbhai', name: 'Nakshbhai' },
                                    { id: 'Devbhai', name: 'Devbhai' }
                                  ]
                                },
                                { 
                                  id: 'rajubhai', name: 'Rajubhai',
                                  children: [
                                    { id: 'Pranshubhai', name: 'Pranshubhai' }
                                  ] 
                                }
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
                                { id: 'tuleshbhai', name: 'Tuleshbhai' }
                              ]
                            },
                            {
                              id: 'parsottambhai',
                              name: 'Parsottambhai',
                              children: [
                                { id: 'vikeshbhai', name: 'Vikeshbhai' }
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
                                { 
                                  id: 'jigneshbhai', name: 'Jigneshbhai',
                                  children: [
                                    { id: 'Rudrabhai', name: 'Rudrabhai' }
                                  ]
                                },
                                { 
                                  id: 'vipulbhai', name: 'Vipulbhai',
                                  children: [
                                    { id: 'Nakshbhai', name: 'Nakshbhai' }
                                  ] 
                                }
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
                                { id: 'harshbhai', name: 'Harshbhai' }
                              ]
                            },
                            {
                              id: 'mukeshbhai',
                              name: 'Mukeshbhai',
                              children: [
                                { id: 'deepbhai', name: 'Deepbhai' }
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