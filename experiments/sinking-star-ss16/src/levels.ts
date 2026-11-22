import type {LevelSpec} from './core.js';
export const SS16_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss16-01",
    "title": "L’atelier des trois passeurs",
    "rows": [
      "####################",
      "#.....#########....#",
      "#.....#########.ggg#",
      "#.Mo..~.~~~~#~~....#",
      "#.....#.#~~~#~~###.#",
      "#######.o#~~#~~m.m.#",
      "#######.~...~~~....#",
      "#.......###~#~~....#",
      "#..W....~~~~#~~....#",
      "#.......~~~~#~~....#",
      "#.o..o..~~~~#~~#####",
      "#...o...~~~~#~~#####",
      "#.......~~~..~~#####",
      "#ooT....~~~..~~#####",
      "#.......~~~..~~#####",
      "#.......~~~~#~~#####",
      "#.......~~~~#~~#####",
      "#.......~~~~#~~#####",
      "####################",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 9,
          "y": 6
        },
        "facing": "SE"
      }
    ],
    "circuits": [
      {
        "id": "cyan",
        "color": 10,
        "buttons": [
          {
            "x": 6,
            "y": 8
          }
        ]
      },
      {
        "id": "violet",
        "color": 15,
        "buttons": [
          {
            "x": 2,
            "y": 9
          },
          {
            "x": 17,
            "y": 5
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 5
        },
        "circuit": "cyan",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 15,
          "y": 5
        },
        "circuit": "cyan",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 18,
          "y": 4
        },
        "circuit": "violet",
        "direction": "S",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 8,
          "y": 6
        },
        "circuit": "cyan",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss16-02",
    "title": "Récupérer avant de combler",
    "rows": [
      "####################",
      "####################",
      "####################",
      "##o..o...o##########",
      "##........####.....#",
      "##........####..T..#",
      "##........####.....#",
      "##........oo~~.....#",
      "##...W....####.....#",
      "##........####.....#",
      "##.M......####.....#",
      "##........#####~####",
      "##........#####~####",
      "##........####.....#",
      "##############g...g#",
      "##############..g..#",
      "##############.....#",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "retour-du-voleur",
        "buttons": [
          {
            "x": 5,
            "y": 12
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 14,
          "y": 7
        },
        "circuit": "retour-du-voleur",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss16-03",
    "title": "Lâcher le miroir, garder son poids",
    "rows": [
      "####################",
      "####################",
      "###......#.......###",
      "###..............###",
      "###......#.......###",
      "###~~~####.......###",
      "##1T....##.......###",
      "##.#######.......###",
      "##.oo.#######~######",
      "##....######.....###",
      "##....######g...g###",
      "##.M.W######..g..###",
      "##....######.....###",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "double-lest",
        "buttons": [
          {
            "x": 5,
            "y": 6
          },
          {
            "x": 3,
            "y": 11
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 3
        },
        "circuit": "double-lest",
        "direction": "E",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 3,
          "y": 5
        },
        "circuit": "double-lest",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 4,
          "y": 5
        },
        "circuit": "double-lest",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 5,
          "y": 5
        },
        "circuit": "double-lest",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss16-04",
    "title": "Le quai des deux impulsions",
    "rows": [
      "##################",
      "##################",
      "##################",
      "##################",
      "##################",
      "##################",
      "###..To###########",
      "###.##############",
      "##....oo..########",
      "##......#~########",
      "##M..W..#~########",
      "##......#.########",
      "##......#......###",
      "#########......###",
      "#########.g.g.g###",
      "#########......###",
      "##################",
      "##################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "poids-conserve",
        "buttons": [
          {
            "x": 5,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "depart-force",
        "buttons": [
          {
            "x": 6,
            "y": 6
          }
        ],
        "color": 10
      },
      {
        "id": "depot-a-deux",
        "buttons": [
          {
            "x": 2,
            "y": 10
          },
          {
            "x": 3,
            "y": 6
          }
        ],
        "color": 11
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 6
        },
        "circuit": "depart-force",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 8
        },
        "circuit": "depot-a-deux",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 11
        },
        "circuit": "poids-conserve",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss16-05",
    "title": "La relève du gardien",
    "rows": [
      "####################",
      "#......####....o...#",
      "#......####....T...#",
      "#...M..####........#",
      "#......~~~~........#",
      "#......####........#",
      "####~######........#",
      "####~########.######",
      "#......###om.m######",
      "#......######.######",
      "#......####........#",
      "#......####........#",
      "#......####........#",
      "#......####........#",
      "#..Woo.####........#",
      "#......####........#",
      "#......####.g..g.g.#",
      "###########........#",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "impulsion",
        "buttons": [
          {
            "x": 4,
            "y": 3
          }
        ],
        "color": 12
      },
      {
        "id": "passerelles",
        "buttons": [
          {
            "x": 11,
            "y": 8
          }
        ],
        "color": 10
      },
      {
        "id": "deux-poids",
        "buttons": [
          {
            "x": 6,
            "y": 14
          },
          {
            "x": 15,
            "y": 4
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 10,
          "y": 8
        },
        "circuit": "impulsion",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 13,
          "y": 9
        },
        "circuit": "deux-poids",
        "direction": "N",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 7,
          "y": 4
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 8,
          "y": 4
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 4
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 4
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 4,
          "y": 6
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 4,
          "y": 7
        },
        "circuit": "passerelles",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss16-06",
    "title": "Le chantier avant la marée basse",
    "rows": [
      "####################",
      "####################",
      "####################",
      "###########...o....#",
      "###########...T....#",
      "###########........#",
      "#........##........#",
      "#........##........#",
      "#..M.....##........#",
      "#......#.~~........#",
      "#.....Woo~~#.......#",
      "#..........#.......#",
      "#........##........#",
      "#........##........#",
      "#........##........#",
      "#........#####...###",
      "#........######.####",
      "#############......#",
      "#############g.g..g#",
      "####################"
    ],
    "circuits": [
      {
        "id": "maree",
        "buttons": [
          {
            "x": 3,
            "y": 8
          }
        ],
        "color": 10
      },
      {
        "id": "ecluse",
        "buttons": [
          {
            "x": 14,
            "y": 6
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 9
        },
        "circuit": "ecluse",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 16
        },
        "circuit": "maree",
        "direction": "N",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 9,
          "y": 9
        },
        "circuit": "maree",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 10
        },
        "circuit": "maree",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 9
        },
        "circuit": "maree",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 10
        },
        "circuit": "maree",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss16-07",
    "title": "Le miroir paie le dernier passage",
    "rows": [
      "####################",
      "#######.o....#######",
      "#######.o....#.....#",
      "#######.T....#.....#",
      "#######......#..M..#",
      "#######......~o....#",
      "#g..###......#.....#",
      "#...###......#######",
      "#g..~~.....W.#######",
      "#...###......#######",
      "#...###......#######",
      "#g..###......#######",
      "###########o########",
      "###########m########",
      "###########.########",
      "###########m########",
      "###########.########",
      "###########.########",
      "####################",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 8
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "dernier-bail",
        "buttons": [
          {
            "x": 8,
            "y": 10
          },
          {
            "x": 11,
            "y": 17
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 3,
          "y": 8
        },
        "circuit": "dernier-bail",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss16-08",
    "title": "Le dernier reflet du gardien",
    "rows": [
      "####################",
      "########mo##########",
      "########...........#",
      "########...........#",
      "#######..o......M..#",
      "#######..T.........#",
      "######......W......#",
      "######.............#",
      "m....~~............#",
      "#.######........##.#",
      "#......#........oo.#",
      "#......#.######.####",
      "#......########.####",
      "#......#####.~~.####",
      "#......#############",
      "#......#############",
      "#......#############",
      "#......#############",
      "#g.g..g#############",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 8
        },
        "facing": "NW"
      },
      {
        "at": {
          "x": 15,
          "y": 13
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "maree-gardee",
        "buttons": [
          {
            "x": 16,
            "y": 4
          },
          {
            "x": 8,
            "y": 1
          }
        ],
        "color": 10
      },
      {
        "id": "chargeur",
        "buttons": [
          {
            "x": 12,
            "y": 6
          }
        ],
        "color": 12
      },
      {
        "id": "reserve",
        "buttons": [
          {
            "x": 6,
            "y": 7
          }
        ],
        "color": 14
      },
      {
        "id": "trois-lests",
        "buttons": [
          {
            "x": 8,
            "y": 11
          },
          {
            "x": 12,
            "y": 13
          },
          {
            "x": 14,
            "y": 9
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 6
        },
        "circuit": "chargeur",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 2
        },
        "circuit": "reserve",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 1,
          "y": 9
        },
        "circuit": "trois-lests",
        "direction": "N",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 5,
          "y": 8
        },
        "circuit": "maree-gardee",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 6,
          "y": 8
        },
        "circuit": "maree-gardee",
        "activeWhen": "pressed"
      }
    ]
  }
];
