import type {LevelSpec} from './core.js';
export const SS06_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss06-01",
    "title": "L’atelier des deux rives",
    "facing": "S",
    "rows": [
      "~~~~~~~~~~~~~~~~~",
      "~.......~~~~~~~~~",
      "~.M.W...~~~~~~~~~",
      "~.o.o...~~~~~~~~~",
      "~...o...~~~~~~~~~",
      "~s~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~",
      "~.....~.~~......~",
      "~.....~.~~....g.~",
      "~...#o~.~~......~",
      "~.....~.~~....g.~",
      "~.....~.~~......~",
      "~.....~.~~......~",
      "~~~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 7,
          "y": 11
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "passage",
        "buttons": [
          {
            "x": 2,
            "y": 4
          }
        ]
      },
      {
        "id": "presse",
        "buttons": [
          {
            "x": 3,
            "y": 9
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 7
        },
        "circuit": "passage",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 5,
          "y": 9
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss06-02",
    "title": "Le pacte des deux îlots",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~",
      "~~~~~g~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~",
      "~.b.Do4.~~~~~~~~~~~",
      "~....#..~~~~~~~~~~~",
      "~.W.....~~~~~~~~~~~",
      "~.......~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~g~~~",
      "~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~.b.D.4.~",
      "~~~~~~~~~~~.......~",
      "~~~~~~~~~~~.M.....~",
      "~~~~~~~~~~~.......~",
      "~~~~~~~~~~~~~~~~~~~"
    ],
    "circuits": [
      {
        "id": "nord",
        "buttons": [
          {
            "x": 12,
            "y": 12
          }
        ]
      },
      {
        "id": "sud",
        "buttons": [
          {
            "x": 2,
            "y": 4
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 4
        },
        "circuit": "nord",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 12
        },
        "circuit": "sud",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss06-03",
    "title": "Les deux rideaux",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~",
      "~#####~.....~~~~~~~",
      "~Woo..~.o...~~~~~~~",
      "~####.~.....~~~~~~~",
      "~.....D.....D.....~",
      "~..M..D..#..D.....~",
      "~.....D.##..D.....~",
      "~.b...D.....D...g.~",
      "~.....D.....D...g.~",
      "~.....D.....D.....~",
      "~.2...D.....D.....~",
      "~~~..~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~"
    ],
    "circuits": [
      {
        "id": "rideaux",
        "buttons": [
          {
            "x": 2,
            "y": 7
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 10
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 9
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 8
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 7
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 6
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 5
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 4
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 10
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 9
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 7
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 6
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 5
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 4
        },
        "circuit": "rideaux",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss06-04",
    "title": "Le ponton chargé",
    "facing": "E",
    "rows": [
      "~~~~~~~~~~~~~~",
      "~~~gg~~~~~~~~~",
      "~~~~~~~~~~~~~~",
      "~Wooooo4.....~",
      "~M~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~"
    ]
  },
  {
    "id": "ss06-05",
    "title": "Le miroir condamné",
    "facing": "E",
    "rows": [
      "~~~~~~~~~~~~~~~",
      "~..~..~~~~~~~~~",
      "~..~..~~~~~~~~~",
      "~M*...~~~~~~~~~",
      "~..~..~~......~",
      "Woo~..~#....g.~",
      "~~~~#.~.......~",
      "~~~~~#~~......~",
      "~~~~~~~~....g.~",
      "~~~~~~~~......~",
      "~~~~~~~~......~",
      "~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 5,
          "y": 6
        },
        "facing": "NE"
      },
      {
        "at": {
          "x": 7,
          "y": 6
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "condamne",
        "buttons": [
          {
            "x": 2,
            "y": 3
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 7,
          "y": 6
        },
        "circuit": "condamne",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss06-06",
    "title": "La diagonale des sentinelles",
    "facing": "N",
    "rows": [
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~m~~~~~~~~~~",
      "~~~~g~~~g~~~~~~~~",
      "~~~~.~~~.~~~~~~~~",
      "~~~~.m...~~~~~~~~",
      "~~~~.....~~~~~~~~",
      "~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~m~~~m~~~",
      "~~~............~~",
      "~~.M...s...~~~~~~",
      "~~.....oo..~~~~~~",
      "~~....W....~~~~~~",
      "~~.........~~~~~~",
      "~~~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 4,
          "y": 10
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "ouest",
        "buttons": [
          {
            "x": 5,
            "y": 6
          }
        ]
      },
      {
        "id": "est",
        "buttons": [
          {
            "x": 6,
            "y": 3
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 5
        },
        "circuit": "ouest",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 8,
          "y": 5
        },
        "circuit": "est",
        "direction": "S",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss06-07",
    "title": "L’écluse à revers",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~.......~....~~~~~~",
      "~~.......~....~~~~~~",
      "~~.....##~..o.~~~~~~",
      "~~..MW.oo~....~~~~~~",
      "~~.....##~....~~~~~~",
      "~~.......~~~.~~~~~~~",
      "~~~~~~~~~~.~s~~~~~~~",
      "~~~~~~~~~~~#~~~~~~~~",
      "~~~~~~~~~~...~~.~~~~",
      "~~~~~~~~~~~~~~~.~~~~",
      "~~~~~~~~~~~~~~~m.m~~",
      "~~~~~~~~~~~~~~~.~~~~",
      "~~~~~~~~~~~~~......~",
      "~~~~~~~~~~~~~.g..g.~",
      "~~~~~~~~~~~~~......~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "E",
    "mirrors": [
      {
        "at": {
          "x": 11,
          "y": 10
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "alignement",
        "buttons": [
          {
            "x": 11,
            "y": 3
          }
        ]
      },
      {
        "id": "sentinelles",
        "buttons": [
          {
            "x": 13,
            "y": 4
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 10,
          "y": 8
        },
        "circuit": "alignement",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 12
        },
        "circuit": "sentinelles",
        "direction": "E",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss06-08",
    "title": "Le rendez-vous des deux ponts",
    "rows": [
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~......~~~~......~~~",
      "~...M..~~~~......~~~",
      "~...o..~~~~..##...~~",
      "~......~~~~.Woo..~~~",
      "~......~~~~..##..s~~",
      "~......~~~~......~~~",
      "~~~.~~~~~~~~~~~~~.~~",
      "~~~.~~~~~~~~~~~~~.~~",
      "~~~.~..~~~~~~~.~~.~~",
      "~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~.~~~~~~~.~~~~~",
      "~~~~~~....m....~~~~~",
      "~~~~~~~~~~.~~~~~~~~~",
      "~~~~~~~~~~m~~~~~~~~~",
      "~~~~~~~~.....~~~~~~~",
      "~~~~~~~~.g.g.~~~~~~~",
      "~~~~~~~~.....~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~"
    ],
    "facing": "S",
    "mirrors": [
      {
        "at": {
          "x": 5,
          "y": 10
        },
        "facing": "SW"
      },
      {
        "at": {
          "x": 14,
          "y": 10
        },
        "facing": "SE"
      }
    ],
    "circuits": [
      {
        "id": "aligner",
        "buttons": [
          {
            "x": 15,
            "y": 5
          }
        ]
      },
      {
        "id": "sentinelles",
        "buttons": [
          {
            "x": 2,
            "y": 5
          }
        ]
      },
      {
        "id": "convergence",
        "buttons": [
          {
            "x": 4,
            "y": 5
          },
          {
            "x": 3,
            "y": 10
          },
          {
            "x": 17,
            "y": 10
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 5,
          "y": 10
        },
        "circuit": "aligner",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 13
        },
        "circuit": "sentinelles",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 6,
          "y": 12
        },
        "circuit": "convergence",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 12
        },
        "circuit": "convergence",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  }
];
