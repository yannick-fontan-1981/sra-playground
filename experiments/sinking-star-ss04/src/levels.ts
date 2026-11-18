import type { LevelSpec } from './core.js';

export const SS04_LEVELS: readonly LevelSpec[] = [
  {
    "id": "SS04-01",
    "title": "L’atelier des échanges",
    "rows": [
      "~~~~~~~~~~~~~~~",
      "~~~~~~~~.~~~o~~",
      "~......~~~~~D~~",
      "~.b.#..~~~~~.g~",
      "~...#.D~b~~~~~~",
      "~...#..~~~~~~~~",
      "~..o...~~~~~~~~",
      "~.W....~~~~~~~~",
      "~......~~~~~~~~",
      "~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 1
        },
        "facing": "SE"
      }
    ],
    "circuits": [
      {
        "id": "presse",
        "buttons": [
          {
            "x": 2,
            "y": 3
          }
        ]
      },
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 8,
            "y": 4
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 4
        },
        "circuit": "presse",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 2
        },
        "circuit": "sortie",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "SS04-02",
    "title": "Le convoyeur des trois salles",
    "rows": [
      "#############",
      "#.......#...#",
      "#Wo.#.......#",
      "#.......#...#",
      "######.###.##",
      "#...#...#...#",
      "#.g.D.......#",
      "#...#...#..b#",
      "#############"
    ]
  },
  {
    "id": "SS04-03",
    "title": "L’échiquier des neuf blocs",
    "rows": [
      "#############",
      "#.....W.#...#",
      "#.o.o.o.D.go#",
      "#.......#...#",
      "#.o.o.o.#####",
      "#.......#####",
      "#.b.o.o.#####",
      "#.......#####",
      "#############"
    ]
  },
  {
    "id": "SS04-04",
    "title": "La galerie des sentinelles",
    "rows": [
      "##############",
      "#W.#m###m#####",
      "#...ooooo...m#",
      "#...ooooo....#",
      "######m###m..#",
      "#####m##m#...#",
      "#m..ooooo....#",
      "#...oo.oo....#",
      "#..m##m#######",
      "#..###########",
      "#....m.m....g#",
      "##..m.m..m...#",
      "##############"
    ]
  },
  {
    "id": "SS04-05",
    "title": "Le long détour des îlots",
    "rows": [
      "~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~...o~",
      "~~~~~~~~~~~~~....~",
      "~~~~~~~~~~~~~....~",
      "~~~~~~~..........~",
      "~~....~....~~~~~~~",
      "~~....~..W.~~~~~~~",
      "~~....~.....~~~~~~",
      "~~...b..~~~.~~~~~~",
      "~~~~~~~~~~....~~~~",
      "~~~~~~~~~~....~~~~",
      "~~~~~~~~~~DDDD~~~~",
      "~~~~~~~~~~..g.~~~~",
      "~~~~~~~~~~~~~~~~~~"
    ]
  },
  {
    "id": "SS04-06",
    "title": "Les deux relais",
    "rows": [
      ".W.~~~~~~~~~~~~..g",
      "....~~~~~~~~~~~...",
      ".b.~~~~~~~~~.~~.o~",
      "..o.~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~",
      "~~~~.b.~~~~~.~~~~~",
      "~~~~.........~~~~~",
      "~~~.....o....~~~~~",
      "~~~~......o..~~~~~"
    ],
    "mirrors": [
      {
        "at": {
          "x": 3,
          "y": 7
        },
        "facing": "NE"
      },
      {
        "at": {
          "x": 12,
          "y": 2
        },
        "facing": "SE"
      }
    ],
    "circuits": [
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 1,
            "y": 2
          },
          {
            "x": 5,
            "y": 5
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 17,
          "y": 0
        },
        "circuit": "sortie",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "SS04-07",
    "title": "Les deux digues",
    "rows": [
      "#################",
      "#.......######g##",
      "#.b.....######D##",
      "#.......#.......#",
      "#.......#.......#",
      "#.......#.......#",
      "#.......#.......#",
      "#~#~~~~~~~~~~~~~#",
      "#...D.......D...#",
      "#.b.....#.......#",
      "#...o.W.#..o....#",
      "#.m....b........#",
      "#.....o.......b.#",
      "#################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 4,
          "y": 2
        },
        "facing": "SW"
      }
    ],
    "circuits": [
      {
        "id": "presse-ouest",
        "buttons": [
          {
            "x": 2,
            "y": 9
          }
        ]
      },
      {
        "id": "presse-est",
        "buttons": [
          {
            "x": 14,
            "y": 12
          }
        ]
      },
      {
        "id": "sortie",
        "buttons": [
          {
            "x": 2,
            "y": 2
          },
          {
            "x": 7,
            "y": 11
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 8
        },
        "circuit": "presse-ouest",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "circuit": "presse-est",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 14,
          "y": 2
        },
        "circuit": "sortie",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "SS04-08",
    "title": "La citadelle des deux presses",
    "rows": [
      "###################",
      "#~~~~~~~~~...#..b~#",
      "#~~~~~~~~~..#m#..~#",
      "#~~~~~.~~~.oob...~#",
      "#~~~~~~~~~.......~#",
      "#~~~~~~~~~.......~#",
      "#~~~~~~~~~o......~#",
      "#~~~~~~~~~.....o.~#",
      "#~~~~~~~~~~~~~.~~~#",
      "#...b.~~~~~~~~~...#",
      "#.....~~~~~~~~~~~.#",
      "#....b.~~~~~~~....#",
      "#.b...~~~~~~~~.~~~#",
      "#.....~~~~~~~~...~#",
      "#.W...~~~~~~~~~~g~#",
      "#m....~~~~~~~~~~~~#",
      "###################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 6,
          "y": 11
        },
        "facing": "NW"
      },
      {
        "at": {
          "x": 6,
          "y": 3
        },
        "facing": "SE"
      }
    ],
    "circuits": [
      {
        "id": "file",
        "buttons": [
          {
            "x": 2,
            "y": 12
          }
        ]
      },
      {
        "id": "pont",
        "buttons": [
          {
            "x": 13,
            "y": 3
          }
        ]
      },
      {
        "id": "deux-poids",
        "buttons": [
          {
            "x": 4,
            "y": 9
          },
          {
            "x": 5,
            "y": 11
          }
        ]
      },
      {
        "id": "ultime",
        "buttons": [
          {
            "x": 16,
            "y": 1
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 3
        },
        "circuit": "file",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 15,
          "y": 7
        },
        "circuit": "pont",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 14,
          "y": 11
        },
        "circuit": "deux-poids",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 13
        },
        "circuit": "ultime",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  }
];
